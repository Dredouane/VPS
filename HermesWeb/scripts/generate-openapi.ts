import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stringify as yamlStringify } from "yaml";

import { parseSql } from "./lib/sql-parser";
import { buildOpenApiDocument } from "./lib/openapi-builder";
import { openApiConfig } from "../openapi/openapi.config";

/**
 * Générateur du contrat API : SQL (source de vérité, D9) → openapi.yaml.
 * Sortie committée — la CI vérifie l'absence de dérive (pnpm gen:check).
 */

const here = dirname(fileURLToPath(import.meta.url));
const hermesWebRoot = join(here, "..");
const repoRoot = join(hermesWebRoot, "..");
const sqlDir = join(repoRoot, openApiConfig.sqlDir);
const outPath = join(hermesWebRoot, "openapi", "openapi.yaml");

const sqlFiles = readdirSync(sqlDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// Concaténation AVANT parsing : les `alter table add column` des fichiers
// tardifs (ex: 005) doivent voir les tables créées dans les précédents.
const sqlText = sqlFiles
  .map((f) => readFileSync(join(sqlDir, f), "utf8"))
  .join("\n");
const tables = parseSql(sqlText);
const parsedFiles = sqlFiles.map((f) => `- ${f}`);

const doc = buildOpenApiDocument(openApiConfig, tables);

const header = [
  "# ⚠️ FICHIER GÉNÉRÉ — NE PAS ÉDITER À LA MAIN",
  "# Source de vérité : HermesCapabilities/sql/generic/*.sql (D9)",
  "#   + HermesWeb/openapi/openapi.config.ts (exposition + opérations)",
  "# Régénération : `pnpm gen:openapi` · Vérification : `pnpm gen:check`",
  "",
].join("\n");

const yamlBody = yamlStringify(doc, { lineWidth: 100, aliasDuplicateObjects: false });
writeFileSync(outPath, header + yamlBody);

const schemaCount = Object.keys(doc.components.schemas).length;
const opCount = openApiConfig.operations.length;
console.log(`✓ openapi.yaml généré : ${tables.length} tables, ${schemaCount} schémas, ${opCount} opérations`);
console.log(`  SQL concaténés (${sqlFiles.length} fichiers) : ${sqlFiles.join(", ")}`);
