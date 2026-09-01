#!/usr/bin/env python3
"""HermesCapabilities — email-gmail — marquage 'traite' (idempotence).

Pose le label GMAIL_LABEL_DONE (ia-traite) sur des message_ids DONNÉS —
uniquement en fin de pipeline réussie (PIPELINE §4.2). Crée le label s'il
n'existe pas. Stdlib uniquement.

Usage : python3 gmail_label.py <message_id> [<message_id>...]
Entrée : env GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN, GMAIL_LABEL_DONE.
Exit : 0 OK · 2 OAuth · 3 réseau.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gmail_poll import API, RETRY_ATTEMPTS, RETRY_BACKOFF_S, refresh_access_token  # noqa: E402

import time  # noqa: E402
import urllib.error  # noqa: E402


def _post_json(url: str, token: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST")
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise RuntimeError(f"auth HTTP {e.code}") from e
            if e.code == 429 and attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_BACKOFF_S * attempt)
                continue
            raise RuntimeError(f"HTTP {e.code}: {url}") from e
        except urllib.error.URLError as e:
            if attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_BACKOFF_S * attempt)
                continue
            raise RuntimeError(f"réseau: {e}") from e
    raise RuntimeError("épuisement des retries")


def _get_json(url: str, token: str) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise RuntimeError(f"auth HTTP {e.code}") from e
            if e.code == 429 and attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_BACKOFF_S * attempt)
                continue
            raise RuntimeError(f"HTTP {e.code}: {url}") from e
        except urllib.error.URLError as e:
            if attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_BACKOFF_S * attempt)
                continue
            raise RuntimeError(f"réseau: {e}") from e
    raise RuntimeError("épuisement des retries")


def ensure_label_id(token: str, label_name: str) -> str:
    """Retourne l'id du label ; le crée s'il n'existe pas (idempotent)."""
    labels = _get_json(f"{API}/labels", token).get("labels", [])
    for lb in labels:
        if lb.get("name") == label_name:
            return lb["id"]
    created = _post_json(f"{API}/labels", token, {
        "name": label_name,
        "labelListVisibility": "labelShow",
        "messageListVisibility": "show",
    })
    return created.get("id") or ""


def label_messages(token: str, label_id: str, message_ids: list[str]) -> int:
    """Pose le label sur chaque message ; retourne le nb de succès."""
    done = 0
    for mid in message_ids:
        try:
            _post_json(f"{API}/messages/{mid}/modify", token,
                       {"addLabelIds": [label_id]})
            done += 1
        except RuntimeError as e:
            print(json.dumps({"error": f"{mid}: {e}"}), file=sys.stderr)
    return done


def main() -> int:
    ids = [a for a in sys.argv[1:] if a.strip()]
    if not ids:
        print("usage: gmail_label.py <message_id> [...]", file=sys.stderr)
        return 1
    cfg = {k: os.environ.get(k, "") for k in
           ("GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN",
            "GMAIL_LABEL_DONE")}
    missing = [k for k in ("GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET",
                           "GMAIL_REFRESH_TOKEN") if not cfg[k]]
    if missing:
        print(json.dumps({"error": "config manquante", "vars": missing}), file=sys.stderr)
        return 2
    label_name = cfg["GMAIL_LABEL_DONE"] or "ia-traite"
    try:
        token = refresh_access_token(cfg["GMAIL_CLIENT_ID"],
                                     cfg["GMAIL_CLIENT_SECRET"],
                                     cfg["GMAIL_REFRESH_TOKEN"])
        label_id = ensure_label_id(token, label_name)
        n = label_messages(token, label_id, ids)
    except RuntimeError as e:
        code = 2 if ("oauth" in str(e) or "auth" in str(e)) else 3
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return code
    print(json.dumps({"labeled": n, "total": len(ids), "label": label_name}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
