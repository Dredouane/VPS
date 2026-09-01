#!/usr/bin/env python3
"""HermesCapabilities — email-gmail — poller Gmail déterministe (C1).

Sortie (stdout) : JSON {"threads": [...], "count": N} — contrat
PIPELINE_EMAIL_AREV.md §2.1. Entrée : env GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL, GMAIL_ALIAS_TAG (+AREV),
GMAIL_LABEL_DONE (ia-traite), GMAIL_MAX_THREADS (5).

Stdlib uniquement (urllib/json/base64/email — aucun pip, invariant I11).
Les fonctions de PARSING sont pures (testables par fixtures, D3) ; les
fonctions réseau sont minces. Les PJ sont référencées par attachment_id
(téléchargement paresseux par l'OCR C3) — le spool ne contient pas les
binaires.

Exit codes : 0 OK · 2 erreur OAuth/credentials · 3 erreur réseau/HTTP.
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

TOKEN_URL = "https://oauth2.googleapis.com/token"
API = "https://gmail.googleapis.com/gmail/v1/users/me"
SCOPE = "https://www.googleapis.com/auth/gmail.modify"
NEWER_THAN_DAYS = 90

RETRY_ATTEMPTS = 3
RETRY_BACKOFF_S = 2


# ─────────────────────────────── helpers (purs) ──────────────────────────────
def b64url_decode(data: str) -> bytes:
    """Décode base64url (payloads Gmail) — padding tolérant."""
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def alias_address(user_email: str, alias_tag: str) -> str:
    """Construit l'adresse aliasée : REDACTED_EMAIL + '+AREV'
    → REDACTED_EMAIL (D10, filtre strict)."""
    tag = alias_tag.strip()
    if tag and not tag.startswith("+"):
        tag = "+" + tag
    local, _, domain = user_email.partition("@")
    return f"{local}{tag}@{domain}"


def build_query(user_email: str, alias_tag: str, label_done: str) -> str:
    """Query Gmail search : destinataire aliasé, non marqué, récent."""
    return (
        f"to:{alias_address(user_email, alias_tag)} "
        f"-label:{label_done} newer_than:{NEWER_THAN_DAYS}d"
    )


def extract_headers(payload: dict) -> dict:
    """Extrait les headers utiles (purs, testables)."""
    want = ("from", "to", "subject", "date", "message-id")
    out = {}
    for h in payload.get("headers", []):
        name = h.get("name", "").lower()
        if name in want and name not in out:
            out[name.replace("-", "_")] = h.get("value", "")
    return out


def _walk_parts(payload: dict):
    """Itère récursivement les parts d'un message API (purs)."""
    stack = [payload]
    while stack:
        p = stack.pop()
        for part in p.get("parts", []) or []:
            stack.append(part)
        yield p


def extract_body_and_attachments(payload: dict) -> tuple[str, list]:
    """Sépare corps texte et pièces jointes (purs, testables).
    Corps : text/plain préféré ; sinon text/html dépouillé (minimal, déterministe).
    PJ : tout part avec filename non vide → métadonnées + attachment_id.
    """
    body_plain, body_html, attachments = None, None, []
    for p in _walk_parts(payload):
        mime = p.get("mimeType", "")
        fname = p.get("filename", "")
        body_data = (p.get("body") or {}).get("data")
        if fname:
            att_id = (p.get("body") or {}).get("attachmentId")
            if att_id:
                attachments.append({
                    "filename": fname,
                    "mime": mime or "application/octet-stream",
                    "size": (p.get("body") or {}).get("size", 0),
                    "attachment_id": att_id,
                })
        elif body_data and mime == "text/plain" and body_plain is None:
            body_plain = b64url_decode(body_data).decode("utf-8", "replace")
        elif body_data and mime == "text/html" and body_html is None:
            body_html = b64url_decode(body_data).decode("utf-8", "replace")
    if body_plain is not None:
        return body_plain, attachments
    if body_html is not None:
        return strip_html(body_html), attachments
    return "", attachments


def strip_html(html: str) -> str:
    """Dépouillage HTML minimal DÉTERMINISTE (pas de LLM, pas de dépendance)."""
    out, i, n = [], 0, len(html)
    while i < n:
        c = html.find("<", i)
        if c == -1:
            out.append(html[i:])
            break
        out.append(html[i:c])
        e = html.find(">", c)
        if e == -1:
            out.append(html[c:])
            break
        tag = html[c:e + 1].lower()
        # séparateurs visuels pour block-level tags (déterministe)
        if tag.startswith(("<br", "<p", "<div", "<tr", "<li", "<table")):
            out.append("\n")
        i = e + 1
    text = "".join(out)
    # entités courantes (ordre fixe)
    for ent, ch in (("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
                    ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")):
        text = text.replace(ent, ch)
    # compaction : lignes vides multiples → simple
    lines = [ln.strip() for ln in text.splitlines()]
    return "\n".join([ln for ln in lines if ln or (out and ln == "")]).strip()


def parse_message(msg_api: dict) -> dict:
    """Un message API Gmail → structure du contrat (pur, testable)."""
    payload = msg_api.get("payload", {})
    headers = extract_headers(payload)
    body, attachments = extract_body_and_attachments(payload)
    return {
        "message_id": msg_api.get("id", ""),
        "thread_id": msg_api.get("threadId", ""),
        "internal_date_ms": (msg_api.get("internalDate") and int(msg_api["internalDate"])) or None,
        **{f"header_{k}": v for k, v in headers.items()},
        "body_plain": body,
        "attachments": attachments,
    }


def parse_thread(thread_api: dict) -> dict:
    """Un thread API → {"thread_id", "messages": [...]} (pur, testable)."""
    return {
        "thread_id": thread_api.get("id", ""),
        "messages": [parse_message(m) for m in thread_api.get("messages", [])],
    }


# ─────────────────────────────── réseau (mince) ──────────────────────────────
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


def refresh_access_token(cid: str, secret: str, refresh_token: str) -> str:
    """Échange refresh token → access token (1 appel, sans retry caché)."""
    data = urllib.parse.urlencode({
        "client_id": cid, "client_secret": secret,
        "refresh_token": refresh_token, "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=data)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())["access_token"]
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"oauth HTTP {e.code}") from e


def list_threads(token: str, query: str, max_threads: int) -> list[str]:
    url = f"{API}/threads?q={urllib.parse.quote(query)}&maxResults={max(min(max_threads, 25), 1)}"
    return [t["id"] for t in _get_json(url, token).get("threads", [])]


def get_thread(token: str, thread_id: str) -> dict:
    """Thread complet (format=full) → structure du contrat."""
    return parse_thread(_get_json(f"{API}/threads/{thread_id}?format=full", token))


def get_attachment(token: str, message_id: str, attachment_id: str) -> bytes:
    """Télécharge une PJ (lazy — appelé par l'OCR C3)."""
    data = _get_json(f"{API}/messages/{message_id}/attachments/{attachment_id}", token)
    return b64url_decode(data.get("data", ""))


# ─────────────────────────────── main ────────────────────────────────────────
def main() -> int:
    cfg = {k: os.environ.get(k, "") for k in (
        "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN",
        "GMAIL_USER_EMAIL", "GMAIL_ALIAS_TAG", "GMAIL_LABEL_DONE",
        "GMAIL_MAX_THREADS")}
    missing = [k for k in ("GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET",
                           "GMAIL_REFRESH_TOKEN", "GMAIL_USER_EMAIL") if not cfg[k]]
    if missing:
        print(json.dumps({"error": "config manquante", "vars": missing}), file=sys.stderr)
        return 2
    alias_tag = cfg["GMAIL_ALIAS_TAG"] or "+AREV"
    label_done = cfg["GMAIL_LABEL_DONE"] or "ia-traite"
    max_threads = int(cfg["GMAIL_MAX_THREADS"] or "5")

    try:
        token = refresh_access_token(cfg["GMAIL_CLIENT_ID"], cfg["GMAIL_CLIENT_SECRET"],
                                     cfg["GMAIL_REFRESH_TOKEN"])
        query = build_query(cfg["GMAIL_USER_EMAIL"], alias_tag, label_done)
        ids = list_threads(token, query, max_threads)
        threads = [get_thread(token, tid) for tid in ids]
    except RuntimeError as e:
        code = 2 if "oauth" in str(e) or "auth" in str(e) else 3
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return code

    print(json.dumps({"threads": threads, "count": len(threads), "query": query},
                     ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
