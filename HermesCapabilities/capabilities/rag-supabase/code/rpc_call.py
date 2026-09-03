#!/usr/bin/env python3
"""HermesCapabilities — rag-supabase — appel RPC générique (PostgREST, stdlib).

Helper unique pour les skills/agents : POST {PROJECT_URL}/rest/v1/rpc/<fn>
avec slug + secret (D8-v3). Jamais de SQL direct, jamais de secret en CLI.

Usage : python3 rpc_call.py <fn> <payload.json | - >
Entrée : env VPS_SUPERBASE_VPS_DB_PROJECT_URL, VPS_SUPERBASE_VPS_DB_RPC_KEY,
         CLIENT_SLUG, CLIENT_RPC_SECRET.
Sortie : corps de la réponse (JSON) — exit 0/2/3.
Purs : build_request, parse_response.
"""
import json
import os
import sys
import urllib.error
import urllib.request

RETRY_ATTEMPTS = 3
RETRY_BACKOFF_S = 2


def build_request(fn: str, payload: dict, project_url: str, rpc_key: str) -> tuple:
    """Pur → (url, request) (testable sans réseau)."""
    url = f"{project_url.rstrip('/')}/rest/v1/rpc/{fn}"
    body = json.dumps(payload, ensure_ascii=False).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "apikey": rpc_key,
        "Authorization": f"Bearer {rpc_key}",
    }, method="POST")
    return url, req


def parse_response(raw: bytes) -> dict:
    """Pur — PostgREST peut renvoyer une liste (returns table) ou un scalaire."""
    d = json.loads(raw or b"null")
    if isinstance(d, list) and len(d) == 1:
        return d[0]
    return d if isinstance(d, (dict, list, int, str)) else None


def call(fn: str, payload: dict) -> object:
    url, req = build_request(fn, payload,
                             os.environ["VPS_SUPERBASE_VPS_DB_PROJECT_URL"],
                             os.environ["VPS_SUPERBASE_VPS_DB_RPC_KEY"])
    err = None
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return parse_response(r.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:200]
            raise RuntimeError(f"RPC {fn}: HTTP {e.code} {body}") from e
        except urllib.error.URLError as e:
            err = f"réseau: {e}"
            if attempt < RETRY_ATTEMPTS:
                import time
                time.sleep(RETRY_BACKOFF_S * attempt)
                continue
    raise RuntimeError(err or "épuisement des retries")


def client_payload(fn_payload: dict) -> dict:
    """Injecte slug + secret du client en tête des args RPC (pur)."""
    slug = os.environ.get("CLIENT_SLUG", "")
    secret = os.environ.get("CLIENT_RPC_SECRET", "")
    if not slug or not secret:
        raise RuntimeError("CLIENT_SLUG/CLIENT_RPC_SECRET absentes de l'env")
    p = {"p_client_slug": slug, "p_rpc_secret": secret}
    p.update(fn_payload or {})
    return p


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: rpc_call.py <fn> [payload.json|-]", file=sys.stderr)
        return 1
    fn = sys.argv[1]
    missing = [k for k in ("VPS_SUPERBASE_VPS_DB_PROJECT_URL",
                           "VPS_SUPERBASE_VPS_DB_RPC_KEY", "CLIENT_SLUG",
                           "CLIENT_RPC_SECRET") if not os.environ.get(k)]
    if missing:
        print(json.dumps({"error": "env manquante", "vars": missing}), file=sys.stderr)
        return 2
    payload = {}
    if len(sys.argv) > 2:
        src = sys.argv[2]
        raw = sys.stdin.read() if src == "-" else open(src, encoding="utf-8").read()
        payload = json.loads(raw or "{}")
    try:
        result = call(fn, client_payload(payload))
    except RuntimeError as e:
        s = str(e)
        print(json.dumps({"error": s}), file=sys.stderr)
        return 2 if "auth" in s.lower() else 3
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
