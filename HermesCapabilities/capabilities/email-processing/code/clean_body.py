#!/usr/bin/env python3
"""HermesCapabilities — email-processing — nettoyage corps email (D20).

Nettoie le contenu nouveau d'un email pour l'affichage utilisateur et
l'indexation RAG. Pur, déterministe, stdlib. Called from run_pipeline after
split_quoted, BEFORE embed + doc_upsert.

R1: [image:…], [cid:…], <img> → retirés
R2: headers de réponse/transfert → "[citation masquée]" (1 ligne)
R3: signatures dupliquées (tél, adresse, disclaimer) → dédoublonnées
R4: contenu principal, listes, tableaux conservés
R5: texte brut, sans HTML ni markdown

Usage: clean_body.py clean(body) → texte propre (pur, testable).
"""
import re
import unicodedata

RE_IMAGE_ARTIFACT = re.compile(
    r"\[image:\s*[^\]]*\]|<img[^>]*(?:/>|>)|\[cid:[^\]]*\]"
)
RE_HTML_TAG = re.compile(r"<[^>]+>")
RE_MD_BOLD = re.compile(r"\*\*[^*]+\*\*")
RE_MD_HEADING = re.compile(r"^#{1,6}\s+", re.M)
RE_MD_ROW = re.compile(r"^\|.*\|$", re.M)
RE_QUOTE_HEADER_FIRST = re.compile(
    r"^(?:De\s*:|From\s*:)"
)
RE_FORWARD_SEP = re.compile(
    r"(?:-{3,}\s*(?:Message d'origine|Original Message|Forwarded message|message trans(?:f|é)ri\w+))",
    re.I,
)
RE_REPLY_HEADER = re.compile(r"^(?:Le .{1,90} a écrite?\s*:|On .{1,90} wrote\s*:)", re.I)
RE_QUOTED_LINE = re.compile(r"^>")
RE_SIGNATURE_PHONE = re.compile(r"(?:\+33|\b0)\d[\d\s.]{8,14}")
RE_SIGNATURE_ADDR = re.compile(
    r"(?:rue|bd|boulevard|avenue|av\.)\s+\w+",
    re.I,
)
RE_DISCLAIMER = re.compile(r"pénal|escompte|code du commerce|responsabilité", re.I)
RE_BLANK_MULTI = re.compile(r"\n{3,}")
RE_EMAIL_ADDR = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
RE_MULTI_SPACES = re.compile(r"[ \t]{3,}")


def _strip_accents(s: str) -> str:
    nfkd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))




def remove_image_artifacts(text: str) -> str:
    """R1: [image:…], [cid:…], <img> cassés, tous les tags HTML résiduels."""
    t = RE_IMAGE_ARTIFACT.sub("", text or "")
    t = RE_HTML_TAG.sub("", t)
    return t


def collapse_quote_headers(text: str) -> str:
    """R2: replie les headers de réponse/transfert → une ligne '[citation masquée]'."""
    lines = (text or "").split("\n")
    out = []
    in_quote = False
    for ln in lines:
        stripped = ln.strip()
        if RE_QUOTE_HEADER_FIRST.match(ln):
            if not in_quote:
                in_quote = True
                out.append("[citation masquée]")
                continue
        elif RE_FORWARD_SEP.search(ln):
            if not in_quote:
                in_quote = True
                out.append("[citation masquée]")
                continue
        else:
            in_quote = False
        out.append(ln)
    return "\n".join(out)


def is_signature_block(block: str) -> bool:
    """Détecte un bloc signature (téléphone, adresse, tél/email répétés, disclaimer)."""
    s = _strip_accents((block or "").strip())
    if len(s) > 350:
        return False
    has_phone = bool(re.search(r"(?:\+33|\d)[\d\s.]{7,12}", s))
    has_addr = bool(RE_SIGNATURE_ADDR.search(s))
    has_cord = "cordialement" in s.lower()[:30] or "best regards" in s.lower()
    return (has_phone or has_addr) and len(s) < 300


def dedup_signatures(text: str) -> str:
    """R3: déduplique les blocs signature répétés (le forward contient N copies)."""
    blocks = text.split("\n\n")
    seen = set()
    out = []
    for b in blocks:
        bstrip = b.strip()
        key = bstrip[:100].lower().strip()
        if not bstrip:
            out.append(b)
            continue
        has_phone = bool(RE_SIGNATURE_PHONE.search(bstrip))
        has_addr = bool(RE_SIGNATURE_ADDR.search(bstrip))
        is_sig = (has_phone or has_addr) and len(bstrip) < 350
        if is_sig and key in seen:
            continue
        if is_sig and key:
            seen.add(key)
        out.append(b)
    return "\n\n".join(out)


def strip_markdown(text: str) -> str:
    """R5: retire les markdown simples (bold, heading, table pipes)."""
    t = RE_MD_BOLD.sub(lambda m: m.group(0).replace("**", ""), text or "")
    t = RE_MD_HEADING.sub("", t)
    return t


def compact_blanks(text: str) -> str:
    """Compacte les lignes vides multiples à max 2."""
    return RE_BLANK_MULTI.sub("\n\n", text or "")


def compact_spaces(text: str) -> str:
    return RE_MULTI_SPACES.sub("  ", text or "")


def strip_cid_refs(text: str) -> str:
    """Retire les [cid:...] inline."""
    return re.sub(r"\[cid:[^\]]*\]", "", text or "")


def clean(body: str) -> str:
    """Orchestre les règles R1-R5 (pur, testé par fixtures).

    Entrée : new_content de thread_parser (déjà split_quoted).
    Sortie : texte propre pour webapp affichage + RAG embedding.
    """
    if not body or not body.strip():
        return ""
    t = body
    t = remove_image_artifacts(t)     # R1 (images, cid, HTML tags)
    t = strip_cid_refs(t)             # R1 (cid)
    t = collapse_quote_headers(t)     # R2 (headers de forward/reply)
    t = dedup_signatures(t)           # R3 (signatures dupliquées)
    t = strip_markdown(t)             # R5 (markdown residual)
    t = compact_spaces(t)
    t = compact_blanks(t)
    return t.strip()
