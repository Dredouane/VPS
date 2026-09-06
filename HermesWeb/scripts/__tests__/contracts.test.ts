import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  parseSql,
  extractEnumValues,
  stripSqlComments,
} from "../lib/sql-parser";
import {
  buildOpenApiDocument,
  buildInsertSchema,
  buildRowSchema,
} from "../lib/openapi-builder";
import { openApiConfig } from "../../openapi/openapi.config";

/** SQL RÉEL du repo — le générateur doit avaler la source de vérité telle quelle. */
const SQL_DIR = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "HermesCapabilities",
  "sql",
  "generic"
);

function parseRealSql(): ReturnType<typeof parseSql> {
  const files = readdirSync(SQL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const text = files.map((f) => readFileSync(join(SQL_DIR, f), "utf8")).join("\n");
  return parseSql(text);
}

const byName = (tables: { name: string }[]) =>
  new Map(tables.map((t) => [t.name, t]));

describe("stripSqlComments", () => {
  it("préserve les chaînes contenant des tirets", () => {
    const sql = "insert into t values ('a--b'); -- commentaire";
    const out = stripSqlComments(sql);
    expect(out).toContain("'a--b'");
    expect(out).toContain("commentaire");
    expect(out).not.toContain("-- commentaire");
  });
});

describe("extractEnumValues", () => {
  it("extrait les valeurs d'un CHECK in", () => {
    expect(extractEnumValues("statut in ('extracted','valide')")).toEqual([
      "extracted",
      "valide",
    ]);
  });
  it("retourne null sans in (...)", () => {
    expect(extractEnumValues("confiance >= 0 and confiance <= 1")).toBeNull();
  });
});

describe("parseSql — SQL réel du repo", () => {
  const tables = parseRealSql();
  const map = byName(tables);

  it("trouve les 7 tables (dont app_users 007)", () => {
    expect(tables.map((t) => t.name).sort()).toEqual([
      "app_users",
      "cap_clients",
      "cap_documents",
      "cap_email_chains",
      "cap_emails",
      "cap_factures",
      "cap_pipeline_runs",
    ]);
  });

  it("cap_factures : colonnes, énumération statut, nullabilité", () => {
    const factures = map.get("cap_factures")!;
    const statut = factures.columns.find((c) => c.name === "statut")!;
    expect(statut.enumValues).toEqual([
      "extracted",
      "valide",
      "rejete",
      "paye",
      "archive",
    ]);
    expect(statut.nullable).toBe(false);
    expect(statut.hasDefault).toBe(true);
    expect(statut.pgType).toBe("text");

    const ht = factures.columns.find((c) => c.name === "montant_ht")!;
    expect(ht.pgType).toBe("numeric(12,2)");
    expect(ht.nullable).toBe(true);

    const numero = factures.columns.find((c) => c.name === "numero")!;
    expect(numero.nullable).toBe(false);
    expect(numero.hasDefault).toBe(false);

    const doc = factures.columns.find((c) => c.name === "document_id")!;
    expect(doc.pgType).toBe("uuid");
    expect(doc.nullable).toBe(true);
  });

  it("cap_documents : embedding vector(768), kind enum, thread_role nullable enum", () => {
    const documents = map.get("cap_documents")!;
    const emb = documents.columns.find((c) => c.name === "embedding")!;
    expect(emb.pgType).toBe("extensions.vector(768)");
    expect(emb.nullable).toBe(true);

    const kind = documents.columns.find((c) => c.name === "kind")!;
    expect(kind.enumValues).toEqual(["email", "attachment"]);
    expect(kind.nullable).toBe(false);

    const role = documents.columns.find((c) => c.name === "thread_role")!;
    expect(role.enumValues).toEqual(["nouveau", "reponse", "transfert"]);
    expect(role.nullable).toBe(true);
  });

  it("cap_emails : CHECK multiligne capturé", () => {
    const emails = map.get("cap_emails")!;
    const status = emails.columns.find((c) => c.name === "status")!;
    expect(status.enumValues).toEqual(["received", "processed", "error"]);
    expect(status.nullable).toBe(false);
  });

  it("cap_clients : colonne rpc_secret ajoutée par alter table (005)", () => {
    const clients = map.get("cap_clients")!;
    const secret = clients.columns.find((c) => c.name === "rpc_secret")!;
    expect(secret).toBeDefined();
    expect(secret.pgType).toBe("text");
    expect(secret.nullable).toBe(true);
    expect(clients.columns.find((c) => c.name === "referent")!.description).toBe(
      "référent (email / nom), optionnel"
    );
  });

  it("app_users (007) : rôle enum + FK user_id", () => {
    const users = map.get("app_users")!;
    const role = users.columns.find((c) => c.name === "role")!;
    expect(role.enumValues).toEqual(["admin", "backoffice", "terrain"]);
    expect(role.hasDefault).toBe(true);

    const userId = users.columns.find((c) => c.name === "user_id")!;
    expect(userId.pgType).toBe("uuid");
    expect(userId.nullable).toBe(false);

    const actif = users.columns.find((c) => c.name === "actif")!;
    expect(actif.pgType).toBe("boolean");
  });
});

describe("buildOpenApiDocument — contrat réel", () => {
  const doc = buildOpenApiDocument(openApiConfig, parseRealSql()) as {
    components: { schemas: Record<string, Record<string, unknown>> };
    paths: Record<string, Record<string, unknown>>;
  };
  const schemas = doc.components.schemas;

  it("génère les schémas ressources + listes + extras", () => {
    for (const name of [
      "Facture",
      "FactureList",
      "FactureUpdate",
      "Email",
      "EmailList",
      "EmailChain",
      "Document",
      "PipelineRun",
      "Client",
      "AppUser",
      "AppUserInsert",
      "Me",
      "Error",
    ]) {
      expect(schemas[name]).toBeDefined();
    }
  });

  it("Facture : propriétés et required conformes au SQL", () => {
    const facture = schemas["Facture"] as {
      properties: Record<string, Record<string, unknown>>;
      required: string[];
    };
    expect(facture.properties["statut"]).toMatchObject({
      type: "string",
      enum: ["extracted", "valide", "rejete", "paye", "archive"],
    });
    expect(facture.properties["montant_ht"]!.type).toEqual(["number", "null"]);
    expect(facture.properties["date_echeance"]).toMatchObject({
      type: ["string", "null"],
      format: "date",
    });
    expect(facture.properties["created_at"]).toMatchObject({
      type: "string",
      format: "date-time",
    });
    // NOT NULL sans default → required
    expect(facture.required).toContain("client_slug");
    expect(facture.required).toContain("numero");
    // Row : required = toutes les NOT NULL (les defaults ne changent rien ici)
    expect(facture.required).toContain("devise");
    expect(facture.required).toContain("created_at");
  });

  it("FactureUpdate : tout optionnel", () => {
    const update = schemas["FactureUpdate"] as { required?: string[] };
    expect(update.required).toBeUndefined();
    expect(
      (schemas["FactureUpdate"] as { properties: Record<string, unknown> })
        .properties["statut"]
    ).toBeDefined();
  });

  it("exclusions de sécurité et d'interne : embedding et rpc_secret absents", () => {
    const document = schemas["Document"] as {
      properties: Record<string, unknown>;
    };
    expect(document.properties["embedding"]).toBeUndefined();
    expect(document.properties["content"]).toBeDefined();
    const client = schemas["Client"] as { properties: Record<string, unknown> };
    expect(client.properties["rpc_secret"]).toBeUndefined();
    expect(client.properties["slug"]).toBeDefined();
  });

  it("DocumentSearchResult et Metadata : JSON libre", () => {
    const result = schemas["DocumentSearchResult"] as {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(result.properties["similarity"]).toMatchObject({ type: "number" });
  });

  it("paths : opérations clés présentes avec operationId", () => {
    const paths = doc.paths;
    expect(paths["/api/v1/me"]).toBeDefined();
    expect(paths["/api/v1/factures"]).toBeDefined();
    const patch = paths["/api/v1/factures/{id}"]["patch"] as Record<
      string,
      unknown
    >;
    expect(patch["operationId"]).toBe("updateFacture");
    expect(patch["requestBody"]).toBeDefined();
    const del = paths["/api/v1/admin/users/{userId}"]["delete"] as {
      responses: Record<string, unknown>;
    };
    expect(del.responses["204"]).toBeDefined();
    expect(del.responses["400"]).toBeUndefined(); // 204 : pas d'erreurs listées
  });

  it("AppUserInsert : user_id + client_slug requis (role a un default)", () => {
    const insert = schemas["AppUserInsert"] as {
      required: string[];
      properties: Record<string, Record<string, unknown>>;
    };
    expect(insert.required).toEqual(["user_id", "client_slug"]);
    expect(insert.properties["role"]).toMatchObject({
      enum: ["admin", "backoffice", "terrain"],
    });
  });
});

describe("buildInsertSchema — unitaire", () => {
  it("NOT NULL sans default → required ; avec default → optionnel", () => {
    const sql = `
      create table if not exists public.demo (
          id      uuid primary key default gen_random_uuid(),
          oblig   text not null,
          avecdef text not null default 'x',
          opt     text
      );
    `;
    const [table] = parseSql(sql);
    const schema = buildInsertSchema(table!) as { required: string[] };
    expect(schema.required).toEqual(["oblig"]);
  });

  it("buildRowSchema : nullable → type [T, null]", () => {
    const sql = `
      create table if not exists public.demo (
          oblig text not null,
          opt   text
      );
    `;
    const [table] = parseSql(sql);
    const schema = buildRowSchema(table!) as {
      properties: Record<string, Record<string, unknown>>;
      required: string[];
    };
    expect(schema.properties["opt"]!.type).toEqual(["string", "null"]);
    expect(schema.required).toEqual(["oblig"]);
  });
});
