#!/usr/bin/env python3
"""HermesCapabilities — email-gmail — marquage 'traite' IMAP (idempotence).

Marquage = COPY → [Gmail]/<label> + \\Deleted + UID EXPUNGE (sémantique
déplacement vers label). Skip si déjà labelisé (X-GM-LABELS). Label créé
s'il manque. UID EXPUNGE (RFC4315) — n'expunge QUE nos uids (fallback
expunge global avec warn). Stdlib uniquement.

Usage : python3 imap_mark_done.py <uid> [<uid>...]   (UIDs INBOX du poller)
Entrée : env VPS_GMAIL_RECEPTION_IMAP_ADRESS, VPS_GMAIL_RECEPTION_IMAP_MDP,
         GMAIL_LABEL_DONE (ia-traite). Exit 0/2/3.
"""
import imaplib
import json
import os
import sys

IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993


def folder_imap(label_name):
    return f"[Gmail]/{label_name}"


def ensure_folder(M, label_name):
    """Retourne (chemin IMAP du label, créé ?) — crée si absent."""
    target = folder_imap(label_name)
    typ, boxes = M.list()
    for b in (boxes or []):
        if label_name in b.decode("utf-8", "replace"):
            return target, False
    M.create(f'"{target}"')
    return target, True


def is_already_labeled(M, uid, label_name):
    typ, fd = M.uid("FETCH", uid, "(X-GM-LABELS)")
    for item in (fd or []):
        blob = item[1] if isinstance(item, tuple) else item
        if blob and label_name in blob.decode("utf-8", "replace"):
            return True
    return False


def mark_done(M, uids, label_name):
    target, created = ensure_folder(M, label_name)
    moved, skipped = [], []
    for uid in uids:
        if is_already_labeled(M, uid, label_name):
            skipped.append(uid)
            continue
        typ, _ = M.uid("COPY", uid, f'"{target}"')
        if typ != "OK":
            raise RuntimeError(f"COPY uid {uid}: {typ}")
        typ, _ = M.uid("STORE", uid, "+FLAGS.SILENT", "(\\Deleted)")
        if typ != "OK":
            raise RuntimeError(f"STORE uid {uid}: {typ}")
        moved.append(uid)
    expunged_via = "uid-expunge"
    try:
        if moved:
            typ, _ = M.uid("EXPUNGE", ",".join(str(u) for u in moved))
            if typ != "OK":
                M.expunge()
                expunged_via = "expunge-global(warn)"
    except Exception:
        M.expunge()
        expunged_via = "expunge-global(warn)"
    return {"moved": moved, "skipped": skipped, "folder": target,
            "folder_created": created, "expunge": expunged_via}


def label_and_delete(cfg: dict, uids: list) -> dict:
    """Wrapper complet : connexion + marquage + logout (pur côté appelant)."""
    M = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    try:
        M.login(cfg["VPS_GMAIL_RECEPTION_IMAP_ADRESS"], cfg["VPS_GMAIL_RECEPTION_IMAP_MDP"])
        M.select("INBOX")  # mode écriture requis (COPY/STORE/EXPUNGE)
        return mark_done(M, uids, cfg.get("GMAIL_LABEL_DONE") or "ia-traite")
    finally:
        try:
            M.logout()
        except Exception:
            pass


def main():
    uids = [u for u in sys.argv[1:] if u.strip().isdigit()]
    if not uids:
        print("usage: imap_mark_done.py <uid> [...]", file=sys.stderr)
        return 1
    cfg = {k: os.environ.get(k, "") for k in
           ("VPS_GMAIL_RECEPTION_IMAP_ADRESS", "VPS_GMAIL_RECEPTION_IMAP_MDP",
            "GMAIL_LABEL_DONE")}
    if not cfg["VPS_GMAIL_RECEPTION_IMAP_ADRESS"] or not cfg["VPS_GMAIL_RECEPTION_IMAP_MDP"]:
        print(json.dumps({"error": "config manquante"}), file=sys.stderr)
        return 2
    label_name = cfg["GMAIL_LABEL_DONE"] or "ia-traite"
    try:
        result = label_and_delete(cfg, uids)
    except (imaplib.IMAP4.error, RuntimeError) as e:
        s = str(e)
        low = s.lower()
        code = 2 if ("auth" in low or "login" in low) else 3
        print(json.dumps({"error": s}), file=sys.stderr)
        return code
    finally:
        try:
            M.logout()
        except Exception:
            pass
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
