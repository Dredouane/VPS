import type {
  OpenApiConfig,
  SqlColumn,
  SqlTable,
  QueryParamConfig,
} from "./types";

/**
 * Construit le document OpenAPI 3.1 à partir du SQL parsé + de la config.
 * Conventions :
 * - Le schéma "Row" porte le nom de la ressource (ex: Facture) ;
 * - Insert : required = NOT NULL sans DEFAULT ; Update : tout optionnel ;
 * - Enumérations CHECK SQL → `enum` JSON Schema (nullable → type ["T","null"]) ;
 * - jsonb → objet libre ; timestamptz → date-time ; date → date ;
 * - Colonnes exclues (embedding, secrets) absentes du contrat.
 */

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";

/** Mapping type PostgreSQL → schéma JSON Schema. */
export function pgTypeToJsonSchema(col: SqlColumn): Record<string, unknown> {
  const t = col.pgType.toLowerCase().replace(/\s+/g, " ");
  const base = (() => {
    if (t === "uuid") return { type: "string", format: "uuid" };
    if (t === "text" || t === "citext" || /^varchar/.test(t) || /^character varying/.test(t))
      return { type: "string" };
    if (t === "smallint" || t === "int" || t === "integer")
      return { type: "integer" };
    if (t === "bigint") return { type: "integer", format: "int64" };
    if (t === "boolean" || t === "bool") return { type: "boolean" };
    if (t === "date") return { type: "string", format: "date" };
    if (t === "timestamptz" || t === "timestamp with time zone")
      return { type: "string", format: "date-time" };
    if (t === "jsonb" || t === "json") return {};
    if (/^(numeric|decimal)/.test(t) || t === "real" || t === "double precision")
      return { type: "number" };
    if (/\.vector\(/.test(t)) return { type: "string", description: "pgvector (interne)" };
    throw new Error(`Type PostgreSQL non mappé : "${col.pgType}" (colonne ${col.name})`);
  })();

  const schema: Record<string, unknown> = { ...base };
  if (col.description) schema.description = col.description;
  return schema;
}

/** Applique la nullabilité OpenAPI 3.1 (type: [T, "null"]). */
function withNullable(schema: Record<string, unknown>, nullable: boolean): Record<string, unknown> {
  if (!nullable || typeof schema.type !== "string") return schema;
  const t = schema.type as string;
  return { ...schema, type: [t, "null"] };
}

/** Colonnes filtrées selon la config ressource. */
function resourceColumns(table: SqlTable, exclude?: string[]): SqlColumn[] {
  const excluded = new Set(exclude ?? []);
  return table.columns.filter((c) => !excluded.has(c.name));
}

function columnSchema(col: SqlColumn): Record<string, unknown> {
  if (col.enumValues) {
    const schema: Record<string, unknown> = { type: "string", enum: [...col.enumValues] };
    if (col.description) schema.description = col.description;
    return withNullable(schema, col.nullable);
  }
  return withNullable(pgTypeToJsonSchema(col), col.nullable);
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

export function buildRowSchema(table: SqlTable, exclude?: string[]): Record<string, unknown> {
  const cols = resourceColumns(table, exclude);
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const col of cols) {
    properties[col.name] = columnSchema(col);
    if (!col.nullable) required.push(col.name);
  }
  const schema: Record<string, unknown> = {
    type: "object",
    additionalProperties: false,
    properties,
  };
  if (required.length > 0) schema.required = required;
  return schema;
}

export function buildInsertSchema(table: SqlTable, exclude?: string[]): Record<string, unknown> {
  const cols = resourceColumns(table, exclude);
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const col of cols) {
    properties[col.name] = columnSchema(col);
    if (!col.nullable && !col.hasDefault) required.push(col.name);
  }
  const schema: Record<string, unknown> = {
    type: "object",
    additionalProperties: false,
    properties,
  };
  if (required.length > 0) schema.required = required;
  return schema;
}

export function buildUpdateSchema(table: SqlTable, exclude?: string[]): Record<string, unknown> {
  const cols = resourceColumns(table, exclude);
  const properties: Record<string, unknown> = {};
  for (const col of cols) {
    properties[col.name] = columnSchema(col);
  }
  return { type: "object", additionalProperties: false, properties };
}

function buildListSchema(itemName: string): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      items: { type: "array", items: ref(itemName) },
      total: { type: "integer", description: "Total pour la pagination offset." },
    },
    required: ["items", "total"],
  };
}

function paramFromQuery(q: QueryParamConfig): Record<string, unknown> {
  const schema =
    q.schema.type === "string"
      ? ({ type: "string", ...(q.schema.enum ? { enum: q.schema.enum } : {}) } as Record<string, unknown>)
      : ({
          type: "integer",
          ...(q.schema.minimum !== undefined ? { minimum: q.schema.minimum } : {}),
          ...(q.schema.maximum !== undefined ? { maximum: q.schema.maximum } : {}),
          ...(q.schema.default !== undefined ? { default: q.schema.default } : {}),
        } as Record<string, unknown>);
  return {
    name: q.name,
    in: "query",
    required: false,
    schema,
    ...(q.description ? { description: q.description } : {}),
  };
}

const errorResponses = {
  "400": {
    description: "Requête invalide (validation OpenAPI)",
    content: { "application/json": { schema: ref("Error") } },
  },
  "401": {
    description: "Non authentifié",
    content: { "application/json": { schema: ref("Error") } },
  },
};

const notFoundResponse = {
  "404": {
    description: "Ressource introuvable",
    content: { "application/json": { schema: ref("Error") } },
  },
};

export function buildOpenApiDocument(
  config: OpenApiConfig,
  tables: SqlTable[]
): Record<string, unknown> {
  const tablesByName = new Map(tables.map((t) => [t.name, t]));

  const schemas: Record<string, unknown> = {};
  for (const resource of config.resources) {
    const table = tablesByName.get(resource.table);
    if (!table) {
      throw new Error(`Table "${resource.table}" introuvable dans le SQL source`);
    }
    schemas[resource.name] = buildRowSchema(table, resource.excludeColumns);
    if (resource.variants?.insert) {
      schemas[`${resource.name}Insert`] = buildInsertSchema(table, resource.excludeColumns);
    }
    if (resource.variants?.update) {
      schemas[`${resource.name}Update`] = buildUpdateSchema(table, resource.excludeColumns);
    }
    schemas[`${resource.name}List`] = buildListSchema(resource.name);
  }
  for (const [name, schema] of Object.entries(config.extraSchemas)) {
    if (schemas[name]) throw new Error(`Schéma extra dupliqué : ${name}`);
    schemas[name] = schema;
  }

  const hasPathParams = (path: string) => /\{(\w+)\}/.test(path);

  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of config.operations) {
    const pathItem: Record<string, unknown> = paths[op.path] ?? {};
    if (pathItem[op.method]) {
      throw new Error(`Opération dupliquée : ${op.method.toUpperCase()} ${op.path}`);
    }
    const parameters: Record<string, unknown>[] = [];
    if (hasPathParams(op.path)) {
      if (!op.pathParams || Object.keys(op.pathParams).length === 0) {
        throw new Error(`pathParams manquant pour ${op.method.toUpperCase()} ${op.path}`);
      }
      for (const [name, schemaName] of Object.entries(op.pathParams)) {
        const extra = config.extraSchemas[schemaName];
        parameters.push({
          name,
          in: "path",
          required: true,
          schema: extra ?? { type: "string" },
        });
      }
    }
    for (const q of op.queryParams ?? []) parameters.push(paramFromQuery(q));

    const success = op.successStatus ?? (op.method === "post" ? 201 : 200);
    const responses: Record<string, unknown> = {};
    if (op.listOf) {
      if (!schemas[`${op.listOf}List`]) {
        throw new Error(`listOf "${op.listOf}" : ressource inconnue`);
      }
      responses[String(success)] = {
        description: op.summary,
        content: { "application/json": { schema: ref(`${op.listOf}List`) } },
      };
    } else if (op.responseSchema) {
      if (!schemas[op.responseSchema]) {
        throw new Error(`responseSchema "${op.responseSchema}" inconnu`);
      }
      responses[String(success)] = {
        description: op.summary,
        content: { "application/json": { schema: ref(op.responseSchema) } },
      };
    } else {
      responses[String(success)] = { description: op.summary };
    }
    if (success !== 204) {
      Object.assign(responses, errorResponses);
      if (hasPathParams(op.path)) Object.assign(responses, notFoundResponse);
    }

    pathItem[op.method] = {
      operationId: op.operationId,
      tags: [op.tag],
      summary: op.summary,
      ...(op.description ? { description: op.description } : {}),
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(op.bodySchema
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: ref(op.bodySchema) } },
            },
          }
        : {}),
      responses,
    };
    paths[op.path] = pathItem;
  }

  const tags = [...new Set(config.operations.map((o) => o.tag))].map((t) => ({ name: t }));

  return {
    openapi: "3.1.0",
    info: config.info,
    servers: [{ url: "/", description: "Same-origin (front + API, 1 service)" }],
    tags,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT de session Supabase (@supabase/ssr)",
        },
      },
      schemas,
    },
    security: [{ bearerAuth: [] }],
    "$schema": JSON_SCHEMA_DIALECT,
  };
}
