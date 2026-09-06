#!/usr/bin/env python3
"""HermesCapabilities — rag-embeddings — vecteurs 768d via Gemini (C4, D5).

Modèle FIGÉ : gemini-embedding-001 (768 dimensions — text-embedding-004 retiré de l'API 01/09) — changer = réindexer
tout le RAG. Stdlib uniquement (urllib). Texte tronqué à EMBED_MAX_CHARS
(limite token du modèle) — le chunking avancé est hors scope M2.

Usage : python3 embed_gemini.py <texte.txt>   (ou stdin si -)
Entrée : env VPS_GEMINI_API_KEY, EMBED_MODEL, EMBED_MAX_CHARS.
Sortie : {"embedding": [768 floats], "model", "chars"} — exit 0/2/3.
Purs : build_payload, parse_embedding.
"""
import json
import os
import sys
import urllib.error
import urllib.request

API = ("https://generativelanguage.googleapis.com/v1beta/models/"
       "{model}:embedContent?key={key}")
DEFAULT_MODEL = "gemini-embedding-001"
DIMENSIONS = 768
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_S = 2


def build_payload(text: str, model: str, max_chars: int) -> dict:
    """Pur — tronque et construit la requête embedContent."""
    t = (text or "").strip()
    if not t:
        raise ValueError("texte vide")
    t = t[: max_chars]
    return {"model": f"models/{model}", "content": {"parts": [{"text": t}]},
            "outputDimensionality": DIMENSIONS}


def parse_embedding(resp: dict) -> list:
    """Réponse API → liste de floats (pur) — dimension vérifiée."""
    vals = (resp.get("embedding") or {}).get("values") or []
    if len(vals) != DIMENSIONS:
        raise ValueError(f"dimension inattendue: {len(vals)} (attendu {DIMENSIONS})")
    return [float(v) for v in vals]


def embed(text: str, api_key: str, model: str = DEFAULT_MODEL,
          max_chars: int = 6000) -> dict:
    """Texte → vecteur 768d (réseau mince, retries backoff)."""
    payload = build_payload(text, model, max_chars)
    url = API.format(model=model, key=urllib.parse.quote(api_key))
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                vals = parse_embedding(json.loads(r.read()))
            return {"embedding": vals, "model": model,
                    "chars": len(payload["content"]["parts"][0]["text"])}
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise RuntimeError(f"auth HTTP {e.code}") from e
            try:
                msg = json.loads(e.read().decode()).get("error", {}).get("message", "")
            except Exception:
                msg = ""
            if e.code == 429 and attempt < RETRY_ATTEMPTS:
                import time
                time.sleep(RETRY_BACKOFF_S * attempt)
                continue
            raise RuntimeError(f"HTTP {e.code}: {msg}") from e
        except urllib.error.URLError as e:
            if attempt < RETRY_ATTEMPTS:
                import time
                time.sleep(RETRY_BACKOFF_S * attempt)
                continue
            raise RuntimeError(f"réseau: {e}") from e
    raise RuntimeError("épuisement des retries")


def main() -> int:
    import urllib.parse
    src = sys.argv[1] if len(sys.argv) > 1 else "-"
    if src == "-":
        text = sys.stdin.read()
    elif os.path.isfile(src):
        text = open(src, encoding="utf-8").read()
    else:
        print("usage: embed_gemini.py <texte.txt | ->", file=sys.stderr)
        return 1
    key = os.environ.get("VPS_GEMINI_API_KEY", "")
    if not key:
        print(json.dumps({"error": "VPS_GEMINI_API_KEY absente"}), file=sys.stderr)
        return 2
    model = os.environ.get("EMBED_MODEL", DEFAULT_MODEL)
    max_chars = int(os.environ.get("EMBED_MAX_CHARS") or 6000)
    try:
        print(json.dumps(embed(text, key, model, max_chars), ensure_ascii=False))
    except (RuntimeError, ValueError) as e:
        low = str(e).lower()
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return 2 if "auth" in low else 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
