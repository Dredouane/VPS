#!/usr/bin/env python3
"""HermesCapabilities — doc-ocr — JUGE GÉNÉRAL (D14, code pur, toujours).

Compare 2 extractions génériques et désigne le winner :
- similarité token-overlap (Jaccard normalisé, stdlib)
- complétude (longueur, chiffres, dates)
- confidence déclarée
- doc_type = majorité des hints + heuristiques code (facture/TVA/montants)
Sortie : {"winner", "scores", "agreement", "low_agreement", "doc_type",
"confidence"} — 100% déterministe. Usage :
  python3 ocr_judge.py <ex1.json> <ex2.json>
"""
import json
import os
import re
import sys
import unicodedata

LOW_AGREEMENT_THRESHOLD = 0.35
FACTURE_KEYWORDS = ("facture", "tva", "montant total", "total ht", "total ttc",
                    "échéance", "numero de facture", "n° de facture")
RE_MONEY = re.compile(r"\d[\d\s\u00a0.,]*\s*[€$]|€\s*\d|\b\d{1,3}(?:[.\s\u00a0]\d{3})+(?:,\d{2})?\b|\b\d+(?:[.,]\d{2})\b")


# ─────────────────────────────── purs ────────────────────────────────────────
def strip_accents_lower(t: str) -> str:
    nfkd = unicodedata.normalize("NFD", t or "")
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def tokens(t: str) -> set:
    return set(re.findall(r"[a-z0-9€%]+", strip_accents_lower(t)))


def token_jaccard(a: str, b: str) -> float:
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def completeness(text: str) -> float:
    """0..1 : longueur relative + présence de chiffres + de dates."""
    n = len(text or "")
    len_score = min(1.0, n / 1500.0)
    has_digits = 1.0 if re.search(r"\d", text or "") else 0.0
    has_date = 1.0 if re.search(r"\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b", text or "") else 0.0
    return round(0.5 * len_score + 0.25 * has_digits + 0.25 * has_date, 4)


def digit_density(text: str) -> float:
    t = text or ""
    if not t:
        return 0.0
    return min(1.0, sum(c.isdigit() for c in t) / max(20, len(t) * 0.15))


def heuristic_facture(text: str) -> bool:
    t = strip_accents_lower(text or "")
    kw = sum(1 for k in FACTURE_KEYWORDS if k in t)
    return kw >= 2 and len(RE_MONEY.findall(text or "")) >= 2


def decide_doc_type(ex1: dict, ex2: dict) -> str:
    """Majorité des hints ; désaccord → heuristique tranche (déterministe)."""
    h1 = (ex1.get("doc_type_hint") or "autre").lower()
    h2 = (ex2.get("doc_type_hint") or "autre").lower()
    if h1 == h2:
        return h1
    hf1, hf2 = heuristic_facture(ex1.get("text", "")), heuristic_facture(ex2.get("text", ""))
    if hf1 or hf2:
        return "facture"
    return h1 if float(ex1.get("confidence") or 0) >= float(ex2.get("confidence") or 0) else h2


def score(ex: dict, sim: float) -> float:
    """Score général 0..100 (composantes normalisées 0..1)."""
    c = completeness(ex.get("text", ""))
    conf = min(max(float(ex.get("confidence") or 0), 0.0), 1.0)
    dd = digit_density(ex.get("text", ""))
    ln = min(1.0, len(ex.get("text", "")) / 2000.0)
    return round(30 * c + 25 * conf + 20 * sim + 15 * dd + 10 * ln, 2)


def judge(ex1: dict, ex2: dict) -> dict:
    """2 extractions génériques → verdict (pur, déterministe, D14 révisé)."""
    text1, text2 = ex1.get("text", ""), ex2.get("text", "")
    absent = ex2.get("extractor") == "absent"
    if absent:
        # D14 révisé: 1 extracteur seul (l'autre indisponible) → ×0,85
        sim, low = 0.0, False
        s1, s2 = score(ex1, 1.0), 0.0
    else:
        sim = round(token_jaccard(text1, text2), 4)
        s1, s2 = score(ex1, sim), score(ex2, sim)
        low = sim < LOW_AGREEMENT_THRESHOLD
    winner = "gemini" if s1 >= s2 else "openrouter"   # tie → gemini (ordre figé)
    winner_ex = ex1 if winner == "gemini" else ex2
    conf = min(max(float(winner_ex.get("confidence") or 0), 0.0), 1.0)
    if absent:
        conf *= 0.85   # D14 révisé: extracteur indisponible (pas divergent)
    elif low:
        conf *= 0.7
    return {
        "winner": winner,
        "scores": {"gemini": s1, "openrouter": s2},
        "agreement": sim,
        "low_agreement": low,
        "extractor_absent": absent,
        "doc_type": decide_doc_type(ex1, ex2),
        "confidence": round(conf, 3),
    }


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: ocr_judge.py <ex1.json> <ex2.json>", file=sys.stderr)
        return 1
    ex1 = json.load(open(sys.argv[1], encoding="utf-8"))
    ex2 = json.load(open(sys.argv[2], encoding="utf-8"))
    print(json.dumps(judge(ex1, ex2), ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
