import { ApiError } from "./api-error";

/**
 * PATCH facture — deux opérations distinctes, JAMAIS les deux dans le même
 * appel (garde D6 + D-B validé par l'architecte) :
 * 1. Transition de statut : { statut } — la cible 'extracted' est interdite
 *    (le statut d'entrée appartient au pipeline) ;
 * 2. Correction de valeurs : champs métier éditables — tracée dans
 *    `extraction.audit` (auteur, date, ancienne valeur → nouvelle).
 */

const STATUT_TRANSITION = "statut" as const;

/** Champs métier éditables par la webapp (TKT-108 — liste fermée). */
export const FACTURE_EDITABLE_FIELDS = [
  "date_facture",
  "date_echeance",
  "montant_ht",
  "montant_tva",
  "montant_ttc",
  "objet",
  "fournisseur",
  "fournisseur_identifiant",
  "devise",
] as const;

export type FactureEditableField = (typeof FACTURE_EDITABLE_FIELDS)[number];

export function pickFacturePatch(
  body: Record<string, unknown>
): { statut: string } {
  if (typeof body.statut !== "string") {
    throw new ApiError(
      400,
      "statut_required",
      "Seule la transition de statut est permise : { statut }"
    );
  }
  if (body.statut === "extracted") {
    throw new ApiError(
      400,
      "forbidden_statut",
      "Le statut d'entrée appartient au pipeline — jamais écrit ici"
    );
  }
  return { statut: body.statut };
}

/** Retourne les champs métier édités (valeurs déjà validées par le contrat). */
export function pickFactureCorrection(
  body: Record<string, unknown>
): Record<string, unknown> {
  if ("statut" in body) {
    throw new ApiError(
      400,
      "mixed_operation",
      "Correction de valeurs et transition de statut sont deux actions distinctes"
    );
  }
  const patch: Record<string, unknown> = {};
  for (const field of FACTURE_EDITABLE_FIELDS) {
    if (field in body) patch[field] = body[field];
  }
  if (Object.keys(patch).length === 0) {
    throw new ApiError(
      400,
      "no_editable_field",
      `Aucun champ éditable fourni (${FACTURE_EDITABLE_FIELDS.join(", ")})`
    );
  }
  return patch;
}

/**
 * Audit de correction : ajoute une entrée dans extraction.audit (jsonb).
 * extraction est un champ métier écrit aussi par le pipeline — on ajoute
 * sans écraser l'existant (read-modify-write).
 */
export function buildAuditEntry(
  authorEmail: string,
  before: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [field, to] of Object.entries(patch)) {
    changes[field] = { from: before[field] ?? null, to };
  }
  const entry = { at: new Date().toISOString(), by: authorEmail, changes };
  return { audit: { push: entry } };
}
