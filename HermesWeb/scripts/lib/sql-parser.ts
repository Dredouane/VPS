import type { SqlColumn, SqlTable } from "./types";

/**
 * Parseur SQL borné aux fichiers `HermesCapabilities/sql/generic/` :
 * - `create table [if not exists] <schema>.<name> ( ... )` avec colonnes et
 *   contraintes inline (`not null`, `default`, `check (...)`, `references`) ;
 * - `alter table <t> add column [if not exists] <c> <type> ...`.
 * Le DDL est contrôlé par le runner `supabase-sql.sh` (D9) — format stable.
 * Les commentaires inline `--` sont convertis en blocs `/* ... *`/ et
 * deviennent les descriptions des champs du contrat. Toute construction
 * inconnue (type non mappé) lève une erreur : le générateur échoue
 * bruyamment plutôt que de produire un contrat faux.
 */

const OPEN_COMMENT = "/*";
const CLOSE_COMMENT = "*/";

/** Convertit les commentaires ligne `-- ...` en commentaires bloc. */
export function stripSqlComments(sql: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") {
      if (inString && sql[i + 1] === "'") {
        out += "''";
        i++;
        continue;
      }
      inString = !inString;
      out += c;
      continue;
    }
    if (!inString && c === "-" && sql[i + 1] === "-") {
      let text = "";
      i += 2;
      while (i < sql.length && sql[i] !== "\n") {
        text += sql[i];
        i++;
      }
      const safe = text.replace(/\*\//g, "*").trim();
      out += safe ? ` ${OPEN_COMMENT} ${safe} ${CLOSE_COMMENT}` : " ";
      continue;
    }
    out += c;
  }
  return out;
}

/** Saute un commentaire bloc positionné en i ; retourne l'index après, ou null. */
function skipBlockComment(text: string, i: number): number | null {
  if (text[i] !== "/" || text[i + 1] !== "*") return null;
  const end = text.indexOf(CLOSE_COMMENT, i + 2);
  return end === -1 ? null : end + CLOSE_COMMENT.length;
}

/** Extrait le premier commentaire bloc du segment (description SQL). */
export function extractInlineComment(rawSegment: string): string | null {
  let inString = false;
  for (let i = 0; i < rawSegment.length; i++) {
    const c = rawSegment[i];
    if (c === "'") inString = !inString;
    if (inString) continue;
    const after = skipBlockComment(rawSegment, i);
    if (after !== null) {
      return (
        rawSegment
          .slice(i + OPEN_COMMENT.length, after - CLOSE_COMMENT.length)
          .replace(/\s+/g, " ")
          .trim() || null
      );
    }
  }
  return null;
}

/** Découpe le contenu d'un bloc `( ... )` sur les virgules de niveau 0. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "'") {
      inString = !inString;
      current += c;
      continue;
    }
    if (inString) {
      current += c;
      continue;
    }
    const after = skipBlockComment(text, i);
    if (after !== null) {
      current += text.slice(i, after);
      i = after - 1;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

const TABLE_CONSTRAINT_KEYWORDS = [
  "unique",
  "primary",
  "foreign",
  "constraint",
  "check",
  "exclude",
];

/** Matche un type PostgreSQL en début de texte, retourne [type, reste]. */
function consumePgType(text: string): [string, string] | null {
  const m = text.match(
    /^\s*([a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)?\s*(?:\([^)]*\))?)([\s\S]*)$/
  );
  if (!m) return null;
  let type = m[1].replace(/\s+/g, " ").trim();
  let rest = m[2];
  const suffix = rest.match(
    /^\s*(with\s+time\s+zone|without\s+time\s+zone|precision)\b/
  );
  if (suffix) {
    type += " " + suffix[1].replace(/\s+/g, " ");
    rest = rest.slice(suffix[0].length);
  }
  return [type, rest];
}

/** Extrait les valeurs d'un CHECK `col in ('a','b')`. */
export function extractEnumValues(checkText: string): string[] | null {
  const m = checkText.match(/in\s*\(([^)]*)\)/);
  if (!m) return null;
  const values = [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  return values.length > 0 ? values : null;
}

function parseColumnSegment(rawSegment: string): SqlColumn | null {
  const description = extractInlineComment(rawSegment);
  const clean = stripSqlComments(rawSegment)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .trim()
    .replace(/,\s*$/, "");
  if (!clean) return null;
  const firstWord = clean.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (TABLE_CONSTRAINT_KEYWORDS.includes(firstWord)) return null;

  const nameMatch = clean.match(/^\s*"?(\w+)"?\s*([\s\S]*)$/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  const rest = nameMatch[2] ?? "";

  const typeAndRest = consumePgType(rest);
  if (!typeAndRest) {
    throw new Error(
      `Type PostgreSQL non reconnu pour la colonne "${name}" : "${rest.trim().slice(0, 80)}"`
    );
  }
  const [pgType, modifiers] = typeAndRest;
  const modLower = modifiers.toLowerCase();

  const nullable = !/\bnot\s+null\b/.test(modLower);
  const hasDefault = /\bdefault\b/.test(modLower);

  let enumValues: string[] | null = null;
  const checkMatch = modifiers.match(/check\s*\(([\s\S]*)\)\s*$/);
  if (checkMatch) {
    enumValues = extractEnumValues(checkMatch[1]);
  }

  return {
    name,
    pgType: pgType.replace(/\s+/g, " "),
    nullable,
    hasDefault,
    enumValues,
    description,
  };
}

/**
 * Style DDL du repo : le commentaire d'une colonne peut être placé APRÈS la
 * virgule (`referent text, -- commentaire`). Un bloc `/* ... *`/ en tête de
 * segment est donc le commentaire trailing de la colonne PRÉCÉDENTE.
 */
function reattributeLeadingComments(segments: string[]): string[] {
  const out = [...segments];
  for (let i = 1; i < out.length; i++) {
    const m = out[i]!.match(/^(\s*\/\*[\s\S]*?\*\/\s*)([\s\S]*)$/);
    if (m && m[2]!.trim()) {
      out[i - 1] = out[i - 1] + " " + m[1]!.trim();
      out[i] = m[2]!;
    }
  }
  return out;
}

function parseCreateTable(statement: string): SqlTable | null {
  const header = statement.match(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)\s*\(/i
  );
  if (!header || header.index === undefined) return null;
  const fullName = header[1];
  const name = fullName.includes(".") ? fullName.split(".").pop()! : fullName;
  const startIdx = statement.indexOf("(", header.index) + 1;
  let depth = 1; // parenthèse ouvrante du bloc déjà franchie
  let inString = false;
  let endIdx = -1;
  for (let i = startIdx; i < statement.length; i++) {
    const c = statement[i];
    if (c === "'") inString = !inString;
    if (inString) continue;
    const after = skipBlockComment(statement, i);
    if (after !== null) {
      i = after - 1;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) throw new Error(`Bloc create table non fermé : ${name}`);
  const inner = statement.slice(startIdx, endIdx);
  const columns: SqlColumn[] = [];
  for (const segment of reattributeLeadingComments(splitTopLevel(inner))) {
    const col = parseColumnSegment(segment);
    if (col) columns.push(col);
  }
  return { name, columns };
}

function parseAlterAddColumn(
  statement: string,
  tablesByName: Map<string, SqlTable>
): void {
  const m = statement.match(
    /alter\s+table\s+(?:if\s+exists\s+)?([\w.]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)([\s\S]+)$/i
  );
  if (!m) return;
  const tableFullName = m[1];
  const tableName = tableFullName.includes(".")
    ? tableFullName.split(".").pop()!
    : tableFullName;
  const table = tablesByName.get(tableName);
  if (!table) return;
  const col = parseColumnSegment(m[2]);
  if (col && !table.columns.some((c) => c.name === col.name)) {
    table.columns.push(col);
  }
}

/** Parse un (ou plusieurs) scripts SQL en tables. */
export function parseSql(sqlText: string): SqlTable[] {
  const stripped = stripSqlComments(sqlText);
  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const tables: SqlTable[] = [];
  const tablesByName = new Map<string, SqlTable>();

  for (const stmt of statements) {
    if (/create\s+table\b/i.test(stmt)) {
      const table = parseCreateTable(stmt);
      if (table) {
        if (tablesByName.has(table.name)) {
          throw new Error(`Table dupliquée : ${table.name}`);
        }
        tables.push(table);
        tablesByName.set(table.name, table);
      }
    }
  }
  for (const stmt of statements) {
    if (/alter\s+table\s+[\w.]+\s+add\s+column/i.test(stmt)) {
      parseAlterAddColumn(stmt, tablesByName);
    }
  }
  return tables;
}
