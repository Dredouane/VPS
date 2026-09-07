import contract from "@hermesweb/api-types/schemas.json";

/**
 * Énumérations dérivées du CONTRAT (jamais dupliquées à la main) :
 * schemas.json ← openapi.yaml ← CHECK SQL.
 */

interface EnumProp {
  enum?: string[];
}

type SchemaMap = {
  schemas: Record<string, { properties?: Record<string, EnumProp> }>;
};

function columnEnum(schemaName: string, column: string): string[] {
  const prop = (contract as SchemaMap).schemas[schemaName]?.properties?.[column];
  if (!prop?.enum) {
    throw new Error(`Enum manquante dans le contrat : ${schemaName}.${column}`);
  }
  return prop.enum;
}

export const FACTURE_STATUTS = columnEnum("Facture", "statut");
export const EMAIL_STATUSES = columnEnum("Email", "status");
export const DOCUMENT_KINDS = columnEnum("Document", "kind");
export const APP_USER_ROLES = columnEnum("AppUser", "role");
export const CLIENT_STATUTS = columnEnum("Client", "statut");
