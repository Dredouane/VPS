#!/usr/bin/env python3
"""HermesCapabilities — doc-ocr — extracteur #1 : Gemini Vision (générique).

Entrée : chemin d'un fichier image/PDF (spool) + env VPS_GEMINI_API_KEY.
Sortie (stdout) : JSON générique {"extractor", "doc_type_hint", "confidence",
"text"} — PAS de schéma facture ici (transcription fidèle, D14).
Stdlib uniquement. Exit 0/2/3. Fonctions pures : build_prompt, parse_output.
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

API = ("https://generativelanguage.googleapis.com/v1beta/models/"
       "gemini-2.0-flash:generateContent")
PROMPT = (
    "Transcris fidèlement TOUT le texte visible de ce document, sans "
    "interprétation ni résumé. Indique ensuite le type de document "
    "(facture, devis, plan, photo, courrier, autre) et ta confiance "
    "(0.0-1.0). Réponds STRICTEMENT en JSON : "
    '{"text": "...", "doc_type_hint": "...", "confidence": 0.0}. '
    "Champ incertain = texte brut sans invention."
)
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_S = 2


def build_prompt() -> str:
    return PROMPT  # pur, figé (constante) — point de test


def parse_output(raw: str) -> dict:
    """Réponse modèle → contrat générique (pur, tolérant, jamais inventé)."""
    try:
        d = json.loads(raw)
        text = d.get("text")
        hint = (d.get("doc_type_hint") or "autre").strip().lower()
        conf = float(d.get("confidence") or 0.0)
    except (json.JSONDecodeError, ValueError, TypeError):
        # réponse non-JSON → le texte brut EST l'extraction, confiance basse
        return {"doc_type_hint": "autre", "confidence": 0.3, "text": raw.strip()}
    if not isinstance(text, str) or not text.strip():
        text = raw.strip()
    conf = min(max(conf, 0.0), 1.0)
    if hint not in ("facture", "devis", "plan", "photo", "courrier"):
        hint = "autre"
    return {"doc_type_hint": hint, "confidence": conf, "text": text.strip()}


def _post(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"})
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise RuntimeError(f"auth HTTP {e.code}") from e
            if e.code == 429 and attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_BACKOFF_S * attempt)
                continue
            raise RuntimeError(f"HTTP {e.code}") from e
        except urllib.error.URLError as e:
            if attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_BACKOFF_S * attempt)
                continue
            raise RuntimeError(f"réseau: {e}") from e
    raise RuntimeError("épuisement des retries")


def extract(path: str, api_key: str) -> dict:
    """Fichier spool → contrat générique (réseau mince)."""
    ext = os.path.splitext(path)[1].lower().lstrip(".")
    mime = {"pdf": "application/pdf", "png": "image/png",
            "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}.get(
                ext, "application/octet-stream")
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    payload = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": mime, "data": b64}},
            {"text": build_prompt()},
        ]}],
        "generationConfig": {"response_mime_type": "application/json"},
    }
    resp = _post(f"{API}?key={urllib.parse.quote(api_key)}", payload)
    try:
        raw = resp["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"réponse Gemini inattendue: {e}") from e
    return dict(parse_output(raw), extractor="gemini")


def main() -> int:
    if len(sys.argv) < 2 or not os.path.isfile(sys.argv[1]):
        print("usage: ocr_gemini.py <fichier>", file=sys.stderr)
        return 1
    key = os.environ.get("VPS_GEMINI_API_KEY", "")
    if not key:
        print(json.dumps({"error": "VPS_GEMINI_API_KEY absente"}), file=sys.stderr)
        return 2
    try:
        print(json.dumps(extract(sys.argv[1], key), ensure_ascii=False))
    except RuntimeError as e:
        low = str(e).lower()
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return 2 if "auth" in low else 3
    return 0


if __name__ == "__main__":
    import urllib.parse  # noqa: E402 (import tardif pour lisibilité)
    sys.exit(main())
