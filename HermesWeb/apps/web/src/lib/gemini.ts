import { ApiError } from "./api-error";
import { geminiKey } from "./env";

/**
 * Embeddings requête pour la recherche RAG — miroir EXACT du pipeline agent
 * (rag-embeddings/code/embed_gemini.py) : même modèle, même dimension,
 * même troncation, sinon l'espace vectoriel ne correspond plus (D5).
 */
const MODEL = "gemini-embedding-001";
const DIMENSIONS = 768;
const MAX_CHARS = 6000;
const API =
  "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={key}";

export async function embedText(text: string): Promise<number[]> {
  const key = geminiKey();
  if (!key) {
    throw new ApiError(
      503,
      "embeddings_unconfigured",
      "GEMINI_API_KEY manquante"
    );
  }
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    throw new ApiError(400, "empty_query", "Requête vide");
  }
  const res = await fetch(
    API.replace("{model}", MODEL).replace("{key}", encodeURIComponent(key)),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${MODEL}`,
        content: { parts: [{ text: trimmed.slice(0, MAX_CHARS) }] },
        outputDimensionality: DIMENSIONS,
      }),
    }
  );
  if (!res.ok) {
    throw new ApiError(502, "embeddings_failed", `Embedding KO (${res.status})`);
  }
  const json = (await res.json()) as { embedding?: { values?: unknown } };
  const values = json.embedding?.values;
  if (
    !Array.isArray(values) ||
    values.length !== DIMENSIONS ||
    values.some((v) => typeof v !== "number")
  ) {
    throw new ApiError(
      502,
      "embeddings_invalid",
      `Embedding invalide (attendu ${DIMENSIONS}d)`
    );
  }
  return values;
}
