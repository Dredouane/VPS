import { ApiError } from "./api-error";

/** Pagination offset commune (bornes = contrat : limit 1..200, offset >= 0). */
export function parsePagination(sp: URLSearchParams): {
  limit: number;
  offset: number;
} {
  const rawLimit = sp.get("limit");
  const rawOffset = sp.get("offset");
  const limit = rawLimit === null ? 50 : Number.parseInt(rawLimit, 10);
  const offset = rawOffset === null ? 0 : Number.parseInt(rawOffset, 10);
  if (Number.isNaN(limit) || limit < 1 || limit > 200) {
    throw new ApiError(400, "invalid_param", "limit doit être 1..200");
  }
  if (Number.isNaN(offset) || offset < 0) {
    throw new ApiError(400, "invalid_param", "offset doit être >= 0");
  }
  return { limit, offset };
}

/** Paramètre enum (valeurs = contrat). */
export function parseEnumParam(
  sp: URLSearchParams,
  name: string,
  allowed: readonly string[]
): string | undefined {
  const raw = sp.get(name);
  if (raw === null) return undefined;
  if (!allowed.includes(raw)) {
    throw new ApiError(
      400,
      "invalid_param",
      `${name} doit être : ${allowed.join(" | ")}`
    );
  }
  return raw;
}
