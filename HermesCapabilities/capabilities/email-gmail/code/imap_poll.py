#!/usr/bin/env python3
"""HermesCapabilities — email-gmail — poller IMAP déterministe (C1).

Sortie stdout : résumé léger {"count", "thread_ids", "spool_dir"}.
Spool : <spool_dir>/threads/<thread_id>/thread.json + att-<n>-<fichier-safe>.
Entrée (env) : GMAIL_RECEPTION_IMAP_ADRESS, GMAIL_RECEPTION_IMAP_MDP,
  GMAIL_ALIAS_TAG (+AREV), GMAIL_LABEL_DONE (ia-traite), GMAIL_MAX_THREADS (5),
  GMAIL_SPOOL_DIR (/opt/data/spool/gmail), GMAIL_NEWER_THAN_DAYS (90).

Garanties (vérifiées live 01/09) : EXAMINE readonly (aucune mutation),
BODY.PEEK[] (jamais \Seen), X-GM-RAW recherche, X-GM-THRID threading,
parsing RFC822 email.parser (stdlib, déterministe — D3). Exit 0/2/3.
"""
import email
import imaplib
import json
import os
import re
import sys
from email import policy
from email.parser import BytesParser

IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993


# ─────────────────────────────── helpers purs (testables) ─────────────────────
def alias_address(base_email, alias_tag):
    tag = (alias_tag or "").strip()
    if tag and not tag.startswith("+"):
        tag = "+" + tag
    local, _, domain = base_email.partition("@")
    return f"{local}{tag}@{domain}"


def build_query(base_email, alias_tag, label_done, newer_than_days):
    return (f"to:{alias_address(base_email, alias_tag)} "
            f"-label:{label_done} newer_than:{int(newer_than_days)}d")


def safe_filename(name, max_len=80):
    base = os.path.basename(name or "attachment.bin")
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._") or "attachment.bin"
    root, ext = os.path.splitext(base)
    return (root[: max_len - len(ext)] + ext) if len(base) > max_len else base


def strip_html(html):
    """Dépouillage HTML minimal DÉTERMINISTE (sans dépendance)."""
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
        if tag.startswith(("<br", "<p", "<div", "<tr", "<li", "<table")):
            out.append("\n")
        i = e + 1
    text = "".join(out)
    for ent, ch in (("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
                    ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")):
        text = text.replace(ent, ch)
    return "\n".join(ln.strip() for ln in text.splitlines()).strip()


def parse_raw_message(raw):
    """RFC822 brut → structure du contrat (pur, testable, D3)."""
    msg = BytesParser(policy=policy.default).parsebytes(raw)

    def h(name):
        v = msg.get(name)
        return str(v) if v is not None else ""

    m = {
        "message_id": h("Message-ID") or h("Message-Id"),
        "header_from": h("From"), "header_to": h("To"),
        "header_subject": h("Subject"), "header_date": h("Date"),
        "header_in_reply_to": h("In-Reply-To"), "header_references": h("References"),
        "body_plain": "", "attachments": [],
    }
    body_plain = msg.get_body(preferencelist=("plain",))
    if body_plain is not None:
        m["body_plain"] = body_plain.get_content()
    else:
        body_html = msg.get_body(preferencelist=("html",))
        if body_html is not None:
            m["body_plain"] = strip_html(body_html.get_content())
    for part in msg.iter_attachments():
        data = part.get_payload(decode=True) or b""
        fname = part.get_filename() or "attachment.bin"
        m["attachments"].append({
            "filename": fname,
            "safe_name": safe_filename(fname),
            "mime": part.get_content_type(),
            "size": len(data),
            "data": data,   # déplacé vers fichier spool par write_thread()
        })
    return m


def parse_uid_attrs(rows):
    """Rows FETCH (UID X-GM-THRID) → {uid: thrid} (pur, regex déterministe)."""
    out = {}
    for item in rows:
        blob = (item[1] if isinstance(item, tuple) else item)
        if not blob:
            continue
        text = blob.decode("utf-8", "replace")
        mu, mt = re.search(r"\bUID (\d+)", text), re.search(r"X-GM-THRID (\d+)", text)
        if mu and mt:
            out[int(mu.group(1))] = int(mt.group(1))
    return out


def group_by_thread(uid_thrid):
    threads = {}
    for uid, thrid in uid_thrid.items():
        threads.setdefault(thrid, []).append(uid)
    for thrid in threads:
        threads[thrid].sort(reverse=True)  # plus récents d'abord
    return threads


def write_thread(spool_dir, thrid, messages):
    """Écrit thread.json + fichiers PJ dans le spool (pur côté chemins)."""
    tdir = os.path.join(spool_dir, "threads", str(thrid))
    os.makedirs(tdir, exist_ok=True)
    for msg in messages:
        for i, att in enumerate(msg["attachments"], 1):
            path = os.path.join(tdir, f"att-{i}-{att['safe_name']}")
            with open(path, "wb") as f:
                f.write(att.pop("data"))
            att["path"] = path
        for key in ("header_in_reply_to", "header_references"):
            msg.pop(key, None)
    path = os.path.join(tdir, "thread.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"thread_id": str(thrid), "messages": messages},
                  f, ensure_ascii=False, indent=1)
    return path


# ─────────────────────────────── IMAP (mince) ─────────────────────────────────
def run(cfg):
    user, mdp = cfg["GMAIL_RECEPTION_IMAP_ADRESS"], cfg["GMAIL_RECEPTION_IMAP_MDP"]
    if not user or not mdp:
        raise RuntimeError("config manquante (IMAP_ADRESS/IMAP_MDP)")
    alias_tag = cfg.get("GMAIL_ALIAS_TAG") or "+AREV"
    label_done = cfg.get("GMAIL_LABEL_DONE") or "ia-traite"
    max_threads = int(cfg.get("GMAIL_MAX_THREADS") or "5")
    newer = int(cfg.get("GMAIL_NEWER_THAN_DAYS") or "90")
    spool = cfg.get("GMAIL_SPOOL_DIR") or "/opt/data/spool/gmail"

    M = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    try:
        M.login(user, mdp)
        M.select("INBOX", readonly=True)  # EXAMINE — zéro mutation
        q = build_query(user, alias_tag, label_done, newer)
        typ, data = M.uid("SEARCH", "X-GM-RAW", f'"{q}"')
        if typ != "OK":
            raise RuntimeError(f"search IMAP: {typ}")
        uids = sorted((int(u) for u in (data[0] or b"").split()), reverse=True)
        if not uids:
            return {"count": 0, "thread_ids": [], "threads": [], "spool_dir": spool}
        typ, attrs = M.uid("FETCH", b",".join(str(u).encode() for u in uids),
                           "(UID X-GM-THRID)")
        if typ != "OK":
            raise RuntimeError(f"fetch attrs: {typ}")
        uid_thrid = parse_uid_attrs(attrs)
        threads = group_by_thread(uid_thrid)
        kept = sorted(threads.keys(),
                      key=lambda t: max(threads[t]), reverse=True)[:max_threads]
        out_threads = []
        for thrid in kept:
            tuids = threads[thrid]
            typ, blobs = M.uid("FETCH",
                               b",".join(str(u).encode() for u in tuids),
                               "(BODY.PEEK[])")
            if typ != "OK":
                raise RuntimeError(f"fetch body: {typ}")
            messages = []
            for item in blobs:
                if isinstance(item, tuple):
                    parsed = parse_raw_message(item[1])
                    mu = re.search(r"\bUID (\d+)", item[0].decode("utf-8", "replace"))
                    parsed["uid"] = int(mu.group(1)) if mu else None
                    messages.append(parsed)
            messages.sort(key=lambda m: -(m["uid"] or 0))
            path = write_thread(spool, thrid, messages)
            out_threads.append({
                "thread_id": str(thrid), "spool_path": path,
                "uids": [m["uid"] for m in messages],
                "message_ids": [m["message_id"] for m in messages],
                "attachments_count": sum(len(m["attachments"]) for m in messages),
            })
        return {"count": len(out_threads),
                "thread_ids": [t["thread_id"] for t in out_threads],
                "threads": out_threads, "spool_dir": spool}
    finally:
        try:
            M.logout()
        except Exception:
            pass


def main():
    cfg = {k: os.environ.get(k, "") for k in (
        "GMAIL_RECEPTION_IMAP_ADRESS", "GMAIL_RECEPTION_IMAP_MDP",
        "GMAIL_ALIAS_TAG", "GMAIL_LABEL_DONE", "GMAIL_MAX_THREADS",
        "GMAIL_SPOOL_DIR", "GMAIL_NEWER_THAN_DAYS")}
    try:
        result = run(cfg)
    except (imaplib.IMAP4.error, RuntimeError) as e:
        s = str(e)
        low = s.lower()
        code = 2 if ("config" in low or "auth" in low or "login" in low) else 3
        print(json.dumps({"error": s}), file=sys.stderr)
        return code
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
