#!/usr/bin/env python3
"""HermesCapabilities — email-processing — thread parser déterministe (C2, D3).

Entrée  : thread.json du spool (sortie imap_poll — voir PIPELINE §2.1) +
          liste optionnelle des message_ids déjà indexés en RAG.
Sortie  : chaîne agrégée + mails structurés {role, position, new_content,
          quoted_segments, rag_status} — contrat PIPELINE §2.2.
Usage   : python3 thread_parser.py <thread.json> [--known ids.txt]
          (stdout = JSON résultat). Pur : aucun I/O réseau, stdlib only (I11).

Règles de parsing (fixtures verrouillées, D3) :
- Rôle : transfert (sujet Fwd/Tr:/Transfert/FW:) > réponse (In-Reply-To/
  References OU quote détectée) > nouveau.
- Quote markers : lignes ">" · "Le … a écrit :" · "On … wrote:" ·
  "----- Message d'origine -----" · "----- Original Message -----" ·
  "----- Mail original -----" · "Forwarded message" · bloc Outlook
  (De :/Envoyé :/À : consécutifs).
- Le contenu AVANT le premier marqueur = contenu nouveau ; l'après = cité.
"""
import json
import os
import re
import sys

# path vendored (d3 v2) : la lib doit être importable depuis le conteneur
_VEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor")
if os.path.isdir(_VEND) and _VEND not in sys.path:
    sys.path.insert(0, _VEND)
from email.utils import parsedate_to_datetime

# ─────────────────────────────── regex (constantes figées) ───────────────────
RE_AUTHOR_FR = re.compile(r"^Le .{0,80}? a \u00e9crit\s*:")
RE_AUTHOR_EN = re.compile(r"^On .{0,80}? wrote\s*:")
RE_FWD_SUBJECT = re.compile(r"^\s*(fwd?|fw|transf(?:ert|\u00e9)|tr)\s*(\[\d+\])?\s*:", re.I)
RE_REPLY_SUBJECT = re.compile(r"^\s*re\s*(\[\d+\])?\s*:", re.I)
RE_SEP_ORIGIN_FR = re.compile(r"^-{3,}\s*message d'origine\s*-{3,}", re.I)
RE_SEP_ORIGIN_EN = re.compile(r"^-{3,}\s*original message\s*-{3,}", re.I)
RE_SEP_MAIL_FR = re.compile(r"^-{3,}\s*mail original\s*-{3,}", re.I)
RE_FWD_LINE = re.compile(r"^forwarded message", re.I)
RE_QUOTE_LINE = re.compile(r"^\s*>")
RE_OUTLOOK_DE = re.compile(r"^\s*(de|from)\s*:", re.I)
RE_OUTLOOK_SENT = re.compile(r"^\s*(envoy\u00e9|sent|date)\s*:", re.I)
RE_FORWARD_HEADER_BLOCK = re.compile(
    r"(?:↓+|-+)\s*[Ff]orwarded message\s*[-↓]+\n"
    r"(?:\w+\s*:[^\n]*\n)+"
    r"\n?"  # blank line optionnelle avant le contenu
)
RE_ADDR = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


# ─────────────────────────────── parsing (purs) ──────────────────────────────
def is_quote_marker(line: str, idx: int, lines: list) -> bool:
    """Vrai si la ligne démarre un bloc cité (déterministe, ordre figé)."""
    if RE_QUOTE_LINE.match(line):
        return True
    if (RE_AUTHOR_FR.match(line) or RE_AUTHOR_EN.match(line)
            or RE_SEP_ORIGIN_FR.match(line) or RE_SEP_ORIGIN_EN.match(line)
            or RE_SEP_MAIL_FR.match(line) or RE_FWD_LINE.match(line)):
        return True
    # bloc Outlook : "De :" suivi (≤3 lignes) de "Envoyé :/Sent :/Date :"
    if RE_OUTLOOK_DE.match(line):
        for nxt in lines[idx + 1: idx + 4]:
            if RE_OUTLOOK_SENT.match(nxt):
                return True
    return False


RE_FORWARD_SEP = re.compile(
    r"(?:─+|-+)\s*(?:Forwarded message|forwarded message|message trans(?:f|é)ri\w+)\s*[-─]+\n"
    r"((?:\s*\w+\s*:[^\n]*\n)+)")


def split_quoted(body: str) -> tuple:
    """Corps → (contenu nouveau, [segments cités]).

    D3 v2 (01/09): D17 — si le corps contient un FORWARD HEADER BLOCK
    ("---------- Forwarded message ---------\nDe :…\nÀ :…"), le texte
    AVANT (l'enveloppe) est ignoré et le contenu APRÈS le bloc header est
    le contenu NOUVEAU (le mail d'origine transféré). Fallback sur la lib
    vendored mailparser_reply (multi-providers, cf. D18).
    """
    body = body or ""
    if not body.strip():
        return "", [], []
    if body.lstrip().startswith(">"):  # mail 100% cité (réponse par défaut avant)
        return "", [body.strip()], []

    # D17: forward header block → contenu forwardé re-parsé en messages individuels
    fwd_match = RE_FORWARD_HEADER_BLOCK.search(body)
    if fwd_match:
        forwarded_body = body[fwd_match.end():].strip()
        if not forwarded_body:
            return "", [], []
        try:
            from mailparser_reply import EmailReplyParser
            fwd_parsed = EmailReplyParser(languages=["fr", "en"]).read(text=forwarded_body)
            if fwd_parsed.replies and len(fwd_parsed.replies) > 1:
                new_content = fwd_parsed.replies[0].body.strip()
                quoted = [f.full_body.strip() for f in fwd_parsed.replies[1:]
                          if (f.full_body or "").strip()]
                return new_content, quoted, fwd_parsed.replies[1:]
        except Exception:
            pass
        return forwarded_body, [], []

    visible, relied_quoted = None, []
    try:
        from mailparser_reply import EmailReplyParser
        mail_parsed = EmailReplyParser(languages=["fr", "en"]).read(text=body)
        # le contenu NOUVEAU = 1ᵉʳ reply (top-post) sans signature/disclaimer
        new_content = (mail_parsed.replies[0].body.strip()
                       if mail_parsed.replies else "")
        if not new_content.strip():
            new_content = strip_html(body).strip() if "<" in body else body.strip()
        # segments cités = fragments marqués quoted / hidden / signature
        quoted = []
        for f in mail_parsed.replies[1:]:
            # chaque mail supplémentaire est plus ancien = "history cité"
            full = (f.full_body or f.body or "").strip()
            if full:
                quoted.append(full.strip())
        return new_content, quoted, []
    except Exception as e:
        quoted = [f"parse_error: {str(e)[:120]}"]
        # fallback contrôlé: tout le body (y compris quotes) comme nouveau
        warn_flag = {"parse_degraded": True}
        return (body if not warn_flag else body.strip()), ([f"fallback: {e}"[:140]] or [""]), []


def detect_role(subject: str, in_reply_to: str, references: str,
                quoted_present: bool) -> str:
    """nouveau | reponse | transfert (ordre : transfert > sujet Re: > headers > quotes)."""
    if RE_FWD_SUBJECT.match(subject or ""):
        return "transfert"
    if RE_REPLY_SUBJECT.match(subject or ""):
        return "reponse"          # sujet Re: sans headers (mails épurés)
    if (in_reply_to or "").strip() or (references or "").strip():
        return "reponse"
    if quoted_present:
        return "reponse"          # réponse sans headers (clients mobiles)
    return "nouveau"


def normalize_subject(subject: str) -> str:
    """Retire préfixes Re:/Tr:/Fwd: empilés (déterministe, idempotent)."""
    out = (subject or "").strip()
    prev = None
    while prev != out:
        prev = out
        out = RE_REPLY_SUBJECT.sub("", out)
        out = RE_FWD_SUBJECT.sub("", out)
        out = out.strip()
    return out


def extract_participants(messages: list) -> list:
    """Adresses dédupliquées (from + to), ordre stable."""
    seen, out = set(), []
    for m in messages:
        for field in ("from", "to"):
            for addr in RE_ADDR.findall(m.get(f"header_{field}") or ""):
                low = addr.lower()
                if low not in seen:
                    seen.add(low)
                    out.append(low)
    return out


def _parse_single_message(content: str, from_addr: str, date_str: str,
                          date_iso: str, subject: str, message_id: str,
                          attachments: list, role: str, rag_status: str,
                          position: int) -> dict:
    """Construit un mail structuré à partir d'un fragment parsé."""
    return {
        "message_id": message_id,
        "uid": None,
        "role": role,
        "position": position,
        "date": date_str,
        "date_iso": date_iso,
        "from": from_addr,
        "subject_raw": subject,
        "new_content": content,
        "quoted_segments": [],
        "attachments": attachments,
        "rag_status": rag_status,
    }


def _extract_from_header(header_line: str) -> str:
    """Extrait l'adresse email depuis une ligne 'De : Nom <email>'."""
    m = RE_ADDR.search(header_line or "")
    return m.group(0) if m else (header_line or "").strip()


RE_FRENCH_DATE = re.compile(
    r"(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)"
    r"\s+(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin"
    r"|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)"
    r"\s+(\d{4})\s+(\d{1,2}):(\d{2})", re.I)
_MONTHS_FR = {"janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4,
              "mai": 5, "juin": 6, "juillet": 7, "août": 8, "aout": 8,
              "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12,
              "decembre": 12}


def _parse_french_date(text: str):
    """Parse 'mercredi 8 avril 2026 17:52' → datetime ou None."""
    m = RE_FRENCH_DATE.search(text or "")
    if not m:
        return None
    from datetime import datetime
    day, month_name, year, hour, minute = m.groups()
    month = _MONTHS_FR.get(month_name.lower())
    if not month:
        return None
    try:
        return datetime(int(year), month, int(day), int(hour), int(minute))
    except (ValueError, TypeError):
        return None


def _extract_date_from_headers(headers: str) -> tuple:
    """Extrait (date_brute, date_iso) depuis les headers d'un fragment."""
    for line in (headers or "").split("\n"):
        line_stripped = line.strip()
        if RE_OUTLOOK_SENT.match(line_stripped) or RE_OUTLOOK_DE.match(line_stripped):
            continue
        # Chercher une ligne de date dans les headers du fragment
        if any(kw in line_stripped.lower() for kw in ("envoyé", "sent", "date",
                                                        "le ", "on ", "wrote")):
            try:
                dt = parsedate_to_datetime(line_stripped.split(":", 1)[-1].strip())
                return line_stripped.split(":", 1)[-1].strip(), dt.isoformat()
            except (TypeError, ValueError, IndexError):
                pass
    return "", None


def _parse_forward_fragments(segments, parent_from: str,
                             parent_date: str, parent_date_iso: str,
                             parent_subject: str, parent_attachments: list,
                             parent_rag_status: str, position_start: int,
                             use_reply_objects: bool = False) -> list:
    """Transforme les quoted_segments d'un forward en mails individuels.

    Si use_reply_objects=True, segments est une liste d'EmailReply objects
    et on utilise .headers pour extraire from/date/subject.
    Sinon, segments est une liste de strings et on parse les headers manuellement.
    """
    re_de_from = re.compile(r"^\s*\*?(de|from)\s*:\*?\s*", re.I)
    re_envoye_sent = re.compile(r"^\s*\*?(envoy\u00e9|sent|date)\s*:\*?\s*", re.I)
    re_objet = re.compile(r"^\s*\*?(objet|subject)\s*:\*?\s*", re.I)
    mails = []
    for i, seg in enumerate(segments):
        if use_reply_objects:
            reply = seg
            body_text = (reply.full_body or reply.body or "").strip()
            header_text = reply.headers or ""
        else:
            if not seg.strip():
                continue
            body_text = seg.strip()
            header_text = ""
        seg_from, seg_date, seg_date_iso, seg_subject = parent_from, parent_date, parent_date_iso, parent_subject

        if header_text:
            for hl in header_text.split("\n"):
                hl = hl.strip()
                if re_de_from.match(hl):
                    addr = _extract_from_header(hl)
                    if addr:
                        seg_from = addr
                elif re_envoye_sent.match(hl):
                    val = re_envoye_sent.sub("", hl).strip()
                    dt = _parse_french_date(val)
                    if dt:
                        seg_date = val
                        seg_date_iso = dt.isoformat()
                    else:
                        try:
                            dt = parsedate_to_datetime(val)
                            seg_date = val
                            seg_date_iso = dt.isoformat()
                        except (TypeError, ValueError):
                            pass
                elif re_objet.match(hl):
                    seg_subject = re_objet.sub("", hl).strip()
            # D22: si subject pas trouvé dans headers, chercher dans le body
            if seg_subject == parent_subject and body_text:
                for line in body_text.split("\n")[:15]:
                    if re_objet.match(line.strip()):
                        seg_subject = re_objet.sub("", line.strip()).strip()
                        break
        elif body_text:
            lines = body_text.split("\n")
            header_lines = []
            body_start = 0
            for j, line in enumerate(lines):
                ls = line.strip()
                if re_de_from.match(ls) or re_envoye_sent.match(ls) or re_objet.match(ls):
                    header_lines.append(ls)
                    body_start = j + 1
                elif (RE_AUTHOR_FR.match(ls) or RE_AUTHOR_EN.match(ls)
                      or RE_SEP_ORIGIN_FR.match(ls) or RE_SEP_ORIGIN_EN.match(ls)):
                    header_lines.append(ls)
                    body_start = j + 1
                elif header_lines and ls:
                    # Continuation de header (multiline: "À :" ou "Cc :")
                    continue
                elif header_lines and not ls:
                    body_start = j + 1
                    break
            if header_lines:
                for hl in header_lines:
                    if re_de_from.match(hl):
                        addr = _extract_from_header(hl)
                        if addr:
                            seg_from = addr
                    elif re_envoye_sent.match(hl):
                        val = re_envoye_sent.sub("", hl).strip()
                        dt = _parse_french_date(val)
                        if dt:
                            seg_date = val
                            seg_date_iso = dt.isoformat()
                        else:
                            try:
                                dt = parsedate_to_datetime(val)
                                seg_date = val
                                seg_date_iso = dt.isoformat()
                            except (TypeError, ValueError):
                                pass
                    elif re_objet.match(hl):
                        seg_subject = re_objet.sub("", hl).strip()
            body_text = "\n".join(lines[body_start:]).strip() if body_start else body_text

        mid = f"quoted-{position_start + i}"
        mails.append(_parse_single_message(
            content=body_text, from_addr=seg_from, date_str=seg_date,
            date_iso=seg_date_iso, subject=seg_subject, message_id=mid,
            attachments=[], role="transfert",
            rag_status=parent_rag_status, position=position_start + i))
    return mails


def parse_mail(m: dict, position: int, known_message_ids: set) -> dict:
    """Un message spool → mail structuré (pur).

    D22 : si le message est un forward avec quoted_segments non vides,
    retourne un dict avec 'forward_mails' contenant les messages individuels
    de la chaîne (pour expansion par parse_thread).
    """
    new_content, quoted, fwd_replies = split_quoted(m.get("body_plain", ""))
    role = detect_role(m.get("header_subject", ""),
                       m.get("header_in_reply_to", ""),
                       m.get("header_references", ""),
                       bool(quoted))
    mid = m.get("message_id", "")
    mail_date = None
    try:
        if m.get("header_date"):
            mail_date = parsedate_to_datetime(m["header_date"]).isoformat()
    except (TypeError, ValueError):
        pass
    atts = [
        {"filename": a.get("filename"), "mime": a.get("mime"),
         "size": a.get("size"), "path": a.get("path")}
        for a in (m.get("attachments") or [])
    ]
    mail = {
        "message_id": mid,
        "uid": m.get("uid"),
        "role": role,
        "position": position,
        "date": m.get("header_date", ""),
        "date_iso": mail_date,
        "from": m.get("header_from", ""),
        "subject_raw": m.get("header_subject", ""),
        "new_content": new_content,
        "quoted_segments": quoted,
        "attachments": atts,
        "rag_status": "known" if mid in known_message_ids else "new",
    }
    # D22 : forward avec chaîne → préparer l'expansion
    if quoted and role == "transfert":
        fwd_from = m.get("header_from", "")
        fwd_date = m.get("header_date", "")
        fwd_subject = m.get("header_subject", "")
        fwd_rag = "known" if mid in known_message_ids else "new"
        forward_mails = [_parse_single_message(
            content=new_content, from_addr=fwd_from, date_str=fwd_date,
            date_iso=mail_date, subject=fwd_subject, message_id=mid,
            attachments=atts, role=role, rag_status=fwd_rag, position=position)]
        forward_mails.extend(_parse_forward_fragments(
            fwd_replies if fwd_replies else quoted,
            fwd_from, fwd_date, mail_date, fwd_subject, atts,
            fwd_rag, position + 1, use_reply_objects=bool(fwd_replies)))
        mail["forward_mails"] = forward_mails
        mail["forward_mails"] = forward_mails
    return mail


def parse_thread(thread_json: dict, known_message_ids=None) -> dict:
    """thread.json spool → contrat complet (pur — PIPELINE §2.2)."""
    known = set(known_message_ids or [])
    raw_msgs = thread_json.get("messages", [])

    def _sort_key(m):
        d = m.get("internal_date_ms") or 0
        return (d, m.get("uid") or 0)

    chrono = sorted(raw_msgs, key=_sort_key)
    mails_raw = [parse_mail(m, i + 1, known) for i, m in enumerate(chrono)]

    # D22 : expansion des forwards en messages individuels
    mails = []
    position = 1
    for m in mails_raw:
        fwd = m.pop("forward_mails", None)
        if fwd:
            for fm in fwd:
                fm["position"] = position
                mails.append(fm)
                position += 1
        else:
            m["position"] = position
            mails.append(m)
            position += 1

    subjects = [m.get("subject_raw", "") for m in mails if m.get("subject_raw")]
    subject_norm = normalize_subject(subjects[-1] if subjects else "")
    dates = [m["date_iso"] for m in mails if m["date_iso"]]
    participants = list(dict.fromkeys(
        m.get("from", "") for m in mails if m.get("from")))
    return {
        "thread_id": str(thread_json.get("thread_id", "")),
        "chain": {
            "subject": subject_norm,
            "participants": participants,
            "messages_count": len(mails),
            "first_message_at": min(dates) if dates else None,
            "last_message_at": max(dates) if dates else None,
        },
        "mails": mails,
        "stats": {
            "total": len(mails),
            "new": sum(1 for m in mails if m["rag_status"] == "new"),
            "known": sum(1 for m in mails if m["rag_status"] == "known"),
            "roles": {r: sum(1 for m in mails if m["role"] == r)
                      for r in ("nouveau", "reponse", "transfert")},
        },
    }


def main() -> int:
    if len(sys.argv) < 2 or not os.path.isfile(sys.argv[1]):
        print("usage: thread_parser.py <thread.json> [--known ids.txt]", file=sys.stderr)
        return 1
    with open(sys.argv[1], encoding="utf-8") as f:
        thread = json.load(f)
    known = set()
    if "--known" in sys.argv:
        path = sys.argv[sys.argv.index("--known") + 1]
        with open(path, encoding="utf-8") as f:
            known = {ln.strip() for ln in f if ln.strip()}
    print(json.dumps(parse_thread(thread, known), ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
