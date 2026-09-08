import { ApiError } from "./api-error";
import { geminiKey } from "./env";

/**
 * Gemini côté webapp :
 * - embeddings REQUÊTE pour la recherche RAG — miroir EXACT du pipeline
 *   agent (rag-embeddings/code/embed_gemini.py) : même modèle, même
 *   dimension, même troncation, sinon l'espace vectoriel ne correspond
 *   plus (D5) ;
 * - chat de conversation : Gemini 2.5 Flash (décision architecte — le
 *   comparatif OpenRouter du rapport M2.8 concerne le pipeline).
 */
const MODEL = "gemini-embedding-001";
const DIMENSIONS = 768;
const MAX_CHARS = 6000;
const CHAT_MODEL = "gemini-flash-latest"; // alias stable — IDs versionnés 404 avec cette clé
const API =
  "https://generativelanguage.googleapis.com/v1beta/models/{model}:{action}?key={key}";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatPassage {
  kind: string;
  title: string | null;
  content: string;
  similarity: number;
}

const CHAT_SYSTEM_PROMPT = [
  "Tu es l'assistant du backoffice d'une PME. Tu réponds aux questions sur",
  "UN échange d'emails précis (une « conversation »), à partir UNIQUEMENT",
  "des extraits fournis (corps de mails et OCR des pièces jointes).",
  "Règles absolues :",
  "1. Si l'information n'est pas dans les extraits, réponds exactement :",
  "   « Je n'ai pas cette information dans cette conversation. » —",
  "   n'invente jamais, n'utilise pas tes connaissances générales.",
  "2. Tu ne connais RIEN d'autre que cette conversation : jamais de données",
  "   d'un autre échange, d'un autre client, ni de contexte externe.",
  "3. Réponds en français, sobre et concis (2-6 phrases sauf demande contraire).",
  "4. Quand l'info vient d'un extrait, cite-le entre crochets, ex. [PJ:",
  "   nom du fichier] ou [Mail: expéditeur].",
].join("\n");

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
    API.replace("{model}", MODEL).replace("{action}", "embedContent").replace(
      "{key}",
      encodeURIComponent(key)
    ),
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

/** Passages du fil → bloc de contexte numéroté pour le prompt. */
export function formatPassages(passages: ChatPassage[]): string {
  return passages
    .map((p, i) => {
      const label =
        p.kind === "attachment"
          ? `PJ: ${p.title ?? "pièce jointe"}`
          : `Mail: ${p.title ?? "corps de mail"}`;
      const body = p.content.slice(0, MAX_CHARS);
      return `[${i + 1}] (${label} — pertinence ${Math.round(p.similarity * 100)}%)\n${body}`;
    })
    .join("\n\n---\n\n");
}

/** Appel LLM de chat (Gemini 2.5 Flash) : question + historique + passages. */
export async function chatComplete(
  question: string,
  history: ChatTurn[],
  passages: ChatPassage[]
): Promise<string> {
  const key = geminiKey();
  if (!key) {
    throw new ApiError(
      503,
      "chat_unconfigured",
      "GEMINI_API_KEY manquante"
    );
  }
  const contextBlock =
    passages.length > 0
      ? formatPassages(passages)
      : "(aucun extrait disponible pour cette conversation)";

  const contents = [
    ...history.slice(-20).map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    {
      role: "user",
      parts: [
        {
          text: `Extraits de la conversation (source unique autorisée) :\n\n${contextBlock}\n\nQuestion : ${question}`,
        },
      ],
    },
  ];

  const res = await fetch(
    API.replace("{model}", CHAT_MODEL).replace("{action}", "generateContent").replace(
      "{key}",
      encodeURIComponent(key)
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CHAT_SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    }
  );
  if (!res.ok) {
    throw new ApiError(502, "chat_failed", `Assistant KO (${res.status})`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const answer = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!answer) {
    throw new ApiError(502, "chat_empty", "Réponse vide de l'assistant");
  }
  return answer;
}
