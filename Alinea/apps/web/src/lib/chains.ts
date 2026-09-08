/**
 * Normalisation défensive des données pipeline :
 * - participants : le pipeline a historiquement stocké une STRING JSON dans
 *   le jsonb (double encodage) — tolérer string | array | null ;
 * - metadata : jsonb libre → objet sûr.
 */

export function normalizeParticipants(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((p): p is string => typeof p === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((p): p is string => typeof p === "string");
      }
    } catch {
      // string simple (une seule adresse ?) — non vide → tableau unitaire
      return raw.trim() ? [raw.trim()] : [];
    }
  }
  return [];
}

export function docMetadata(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // jsonb malformé → vide
    }
  }
  return {};
}
