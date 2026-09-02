#!/usr/bin/env python3
"""HermesCapabilities — doc-ocr — ADAPTATEUR SLM facture (branche facture).

Reformate le texte gagnant (générique) en JSON facture canonique via Gemini
Flash (SLM rapide). La sortie est TOUJOURS re-validée par invoice_check.py
(le SLM n'est jamais le juge — D14). Échec de reformat = sums_ok null.
Usage : python3 invoice_adapter.py <texte-gagnant.txt>
Entrée : env GEMINI_API_KEY. Exit 0/2/3.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ocr_gemini import _post  # noqa: E402  (réseau mince partagé)

SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "..", "schemas", "invoice_extraction.json")
ADAPTER_MODEL = "gemini-2.0-flash"


def build_prompt(text: str, schema_str: str) -> str:
    """Pur — le prompt impose le schéma et interdit l'invention."""
    return (
        "Extrait les champs de FACTURE du texte suivant en un JSON strict "
        f"conforme à cette structure : {schema_str}\n"
        "Règles : un champ absent ou illisible = null. N'invente JAMAIS une "
        "valeur. Les nombres restent des nombres (pas de texte).\n\n"
        f"TEXTE :\n{text}"
    )


def parse_adapter_output(raw: str) -> dict | None:
    """JSON du SLM → dict | None (pur, tolérant)."""
    try:
        d = json.loads(raw)
        return d if isinstance(d, dict) else None
    except (json.JSONDecodeError, TypeError):
        return None


def load_schema() -> str:
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return json.dumps(json.load(f), ensure_ascii=False)


def adapt(text: str, api_key: str) -> dict:
    """Texte gagnant → JSON facture (réseau mince). Lève RuntimeError."""
    payload = {
        "contents": [{"parts": [{"text": build_prompt(text, load_schema())}]}],
        "generationConfig": {"response_mime_type": "application/json",
                             "temperature": 0},
    }
    url = ("https://generativelanguage.googleapis.com/v1beta/models/"
           f"{ADAPTER_MODEL}:generateContent?key={api_key}")
    resp = _post(url, payload)
    try:
        raw = resp["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"réponse SLM inattendue: {e}") from e
    parsed = parse_adapter_output(raw)
    if parsed is None:
        raise RuntimeError("sortie SLM non-JSON")
    return parsed


def main() -> int:
    src = sys.argv[1] if len(sys.argv) > 1 else None
    if not src or not os.path.isfile(src):
        print("usage: invoice_adapter.py <texte-gagnant.txt>", file=sys.stderr)
        return 1
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        print(json.dumps({"error": "GEMINI_API_KEY absente"}), file=sys.stderr)
        return 2
    text = open(src, encoding="utf-8").read()
    try:
        print(json.dumps(adapt(text, key), ensure_ascii=False, indent=1))
    except RuntimeError as e:
        low = str(e).lower()
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return 2 if "auth" in low else 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
