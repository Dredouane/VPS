import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

import { ApiError } from "./api-error";
import contract from "@alinea/api-types/schemas.json";

/**
 * Validation runtime pilotée par le contrat : les schémas viennent de
 * `packages/api-types/src/generated/schemas.json` — lui-même généré depuis
 * `openapi/openapi.yaml` (généré depuis le SQL). Zéro schéma écrit à la main.
 * OpenAPI 3.1 = JSON Schema 2020-12 → Ajv mode 2020.
 */

type SchemaMap = {
  schemas: Record<string, Record<string, unknown>>;
};

const contractSchemas = (contract as SchemaMap).schemas;

let ajv: Ajv2020 | null = null;
const compiled = new Map<string, ReturnType<Ajv2020["compile"]>>();

function getAjv(): Ajv2020 {
  if (!ajv) {
    ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
  }
  return ajv;
}

export function getValidator(schemaName: string) {
  let fn = compiled.get(schemaName);
  if (!fn) {
    const schema = contractSchemas[schemaName];
    if (!schema) {
      throw new Error(`Schéma de contrat inconnu : ${schemaName}`);
    }
    fn = getAjv().compile(schema);
    compiled.set(schemaName, fn);
  }
  return fn;
}

/** Valide des données contre un schéma du contrat ; ApiError 400 sinon. */
export function validateAgainstContract(
  schemaName: string,
  data: unknown
): void {
  const valid = getValidator(schemaName)(data);
  if (!valid) {
    const errors = getValidator(schemaName).errors ?? [];
    const details = errors
      .map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim())
      .slice(0, 5)
      .join("; ");
    throw new ApiError(
      400,
      "validation_failed",
      `Corps invalide (${schemaName}) : ${details}`
    );
  }
}
