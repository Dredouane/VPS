import { ApiError } from "./api-error";

/**
 * PATCH facture = validation humaine (D6) : seule la transition de statut
 * est exposée par l'API webapp. L'appartenance du statut à l'enum CHECK est
 * déjà garantie par la validation Ajv du contrat (FactureUpdate.statut).
 */
export function pickFacturePatch(
  body: Record<string, unknown>
): { statut: string } {
  if (typeof body.statut !== "string") {
    throw new ApiError(
      400,
      "statut_required",
      "Seule la transition de statut est permise (D6) : { statut }"
    );
  }
  if (body.statut === "extracted") {
    throw new ApiError(
      400,
      "forbidden_statut",
      "Le statut 'extracted' appartient au pipeline — jamais écrit par la webapp (D6)"
    );
  }
  return { statut: body.statut };
}
