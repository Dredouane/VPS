#!/usr/bin/env python3
"""HermesCapabilities — doc-ocr — extracteur #2 : OpenRouter (générique).

AUCUN restriction sur le type de document: images ET PDF via le content
type `file` (pas image_url) + moteur `cloudflare-ai` parsé librement, cf.
OpenRouter docs PDFs (01/09). Stdlib uniquement.
Usage: ocr_openrouter.py <fichier> — exit 0/2/3.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ocr_gemini import build_prompt, parse_output, RETRY_ATTEMPTS, RETRY_BACKOFF_S  # noqa: E402

API = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-4o-mini"


def _post(url: str, payload: dict, key: str) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    import time
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
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


def extract(path: str, key: str, model: str = None) -> dict:
    """Fichier image OU PDF → contrat générique (via le file type OpenRouter)."""
    if not model:
        model = os.environ.get("OCR_OPENROUTER_MODEL", DEFAULT_MODEL)
    ext = os.path.splitext(path)[1].lower().lstrip(".")
    with open(path, "rb") as f:
        data = f.read()
    b64 = base64.b64encode(data).decode()

    if ext == "pdf":
        # le format `file` (OpenRouter + moteurs cloudflare-ai/native) pour les PDFs
        content_part = [{"type": "file",
                         "file": {"filename": os.path.basename(path),
                                  "file_data": f"data:application/pdf;base64,{b64}"}},
                        {"type": "text", "text": build_prompt()}]
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": content_part}],
            "plugins": [{"id": "file-parser", "pdf": {"engine": "cloudflare-ai"}}],
        }
    else:
        mime = {"png": "image/png", "jpg": "image/jpeg",
                "jpeg": "image/jpeg", "webp": "image/webp"}.get(ext, "application/octet-stream")
        data_uri = f"data:{mime};base64,{b64}"
        content_part = [{"type": "image_url", "image_url": {"url": data_uri}},
                        {"type": "text", "text": build_prompt()}]
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": content_part}],
            "response_format": {"type": "json_object"},
        }

    resp = _post(API, payload, key)
    try:
        raw = resp["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"réponse OpenRouter inattendue: {e}") from e
    return dict(parse_output(raw), extractor="openrouter")


def main() -> int:
    if len(sys.argv) < 2 or not os.path.isfile(sys.argv[1]):
        print("usage: ocr_openrouter.py <fichier>", file=sys.stderr)
        return 1
    key = os.environ.get("VPS_OPEN_ROUTER_API_KEY", "")
    if not key:
        print(json.dumps({"error": "VPS_OPEN_ROUTER_API_KEY absente"}), file=sys.stderr)
        return 2
    try:
        print(json.dumps(extract(sys.argv[1], key), ensure_ascii=False))
    except RuntimeError as e:
        low = str(e).lower()
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return 2 if "auth" in low else 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
