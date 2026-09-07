import contract from "@hermesweb/api-types/schemas.json";
import type { components } from "@hermesweb/api-types/schema";

/**
 * Énumérations dérivées du CONTRAT (jamais dupliquées à la main) :
 * schemas.json ← openapi.yaml ← CHECK SQL.
 * Les unions TS viennent du schéma généré (même source).
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

export type FactureStatut = components["schemas"]["Facture"]["statut"];
export type EmailStatus = components["schemas"]["Email"]["status"];
export type DocumentKind = components["schemas"]["Document"]["kind"];
export type AppUserRole = components["schemas"]["AppUser"]["role"];

export const FACTURE_STATUTS = columnEnum(
  "Facture",
  "statut"
) as readonly FactureStatut[];
export const EMAIL_STATUSES = columnEnum(
  "Email",
  "status"
) as readonly EmailStatus[];
export const DOCUMENT_KINDS = columnEnum(
  "Document",
  "kind"
) as readonly DocumentKind[];
export const APP_USER_ROLES = columnEnum(
  "AppUser",
  "role"
) as readonly AppUserRole[];
export type ClientStatut = components["schemas"]["Client"]["statut"];
export const CLIENT_STATUTS = columnEnum(
  "Client",
  "statut"
) as readonly ClientStatut[];
