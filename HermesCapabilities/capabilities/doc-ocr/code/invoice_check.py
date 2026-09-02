#!/usr/bin/env python3
"""HermesCapabilities — doc-ocr — CHECK MONTANT facture (D14, code pur).

Entrée : données d'extraction (JSON, hétérogène — sortie SLM adapter ou autre).
Traitements : normalisation défensive (aliases, nombres FR/EN, dates) puis
vérifications arithmétiques : Σ lignes == HT · HT + TVA == TTC (±tolérance).
Sortie : {"invoice": canonique, "fails": [...], "sums": {ht_ok, ttc_ok,
sums_ok, detail}} — ne JAMAIS inventer une valeur. Usage :
  python3 invoice_check.py <data.json>
"""
import json
import os
import sys

TOLERANCE = 0.02

ALIASES = {
    "numero": ("numero", "n°", "no", "num_facture", "facture_no", "invoice_number", "number"),
    "fournisseur": ("fournisseur", "emetteur", "vendor", "societe"),
    "fournisseur_identifiant": ("fournisseur_identifiant", "siret", "tva_intracom", "vat"),
    "objet": ("objet", "objet_facture", "description_generale"),
    "date_facture": ("date_facture", "date", "invoice_date"),
    "date_echeance": ("date_echeance", "echeance", "due_date", "date_limite"),
    "montant_ht": ("montant_ht", "total_ht", "ht", "total_hors_taxe"),
    "montant_tva": ("montant_tva", "tva", "montant_t_v_a"),
    "montant_ttc": ("montant_ttc", "total_ttc", "ttc", "montant_total", "total"),
    "devise": ("devise", "currency", "monnaie"),
}
LINE_ALIASES = {
    "designation": ("designation", "libelle", "description", "item"),
    "montant": ("montant", "montant_ht", "total", "prix", "amount"),
}


# ─────────────────────────────── purs ────────────────────────────────────────
def normalize_number(v):
    """Nombre déjà numérique OU chaîne FR/EN ('1 234,56' / '1,234.56' /
    '1234.56' / '1 234') → float | None (jamais d'exception)."""
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace("\u00a0", " ").replace("€", "").replace("$", "").strip()
    if not s:
        return None
    s = s.replace(" ", "")
    neg = s.startswith("-")
    s = s.lstrip("+-")
    if "," in s and "." in s:
        # le dernier séparateur rencontré est le séparateur décimal
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        x = float(s)
        return -x if neg else x
    except ValueError:
        return None


def _norm_key(k):
    import re
    import unicodedata
    nfkd = unicodedata.normalize("NFD", str(k or ""))
    key = "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()
    return re.sub(r"\s+", "_", key)


def pick(d: dict, aliases: tuple):
    """Première valeur trouvée par alias (clés normalisées)."""
    for a in aliases:
        for k, v in (d or {}).items():
            if _norm_key(k) == a:
                return v
    return None


def normalize_invoice(data: dict) -> tuple:
    """Extraction hétérogène → facture canonique + liste des échecs."""
    fails, out = [], {}
    for canon, aliases in ALIASES.items():
        raw = pick(data, aliases)
        if canon.startswith("montant"):
            val = normalize_number(raw)
            if raw is not None and val is None:
                fails.append(f"{canon}: '{raw}' non numérique")
        elif canon in ("numero", "fournisseur", "fournisseur_identifiant",
                       "objet", "date_facture", "date_echeance", "devise"):
            val = str(raw).strip() if raw is not None and str(raw).strip() else None
        else:
            val = raw
        out[canon] = val
    # lignes
    raw_lines = pick(data, ("lignes", "lines", "items"))
    lines = []
    if isinstance(raw_lines, list):
        for i, it in enumerate(raw_lines, 1):
            if not isinstance(it, dict):
                fails.append(f"ligne {i}: non-objet")
                continue
            des = pick(it, LINE_ALIASES["designation"])
            amt = normalize_number(pick(it, LINE_ALIASES["montant"]))
            if des is None and amt is None:
                continue
            if pick(it, LINE_ALIASES["montant"]) is not None and amt is None:
                fails.append(f"ligne {i}: montant non numérique")
            lines.append({"designation": str(des) if des else None, "montant": amt})
    elif raw_lines is not None:
        fails.append("lignes: format non-liste")
    out["lignes"] = lines or None
    return out, fails


def check_sums(invoice: dict, tol: float = TOLERANCE) -> dict:
    """Vérifications arithmétiques (pur). sums_ok=None si non vérifiable."""
    ht, tva, ttc = invoice.get("montant_ht"), invoice.get("montant_tva"), invoice.get("montant_ttc")
    lines = invoice.get("lignes") or []
    ht_ok = ttc_ok = None
    detail = []
    amounts = [l.get("montant") for l in lines]
    if lines and all(a is not None for a in amounts) and ht is not None:
        s = round(sum(amounts), 2)
        ht_ok = abs(s - ht) <= tol
        detail.append(f"Σ lignes {s} vs HT {ht} → {'OK' if ht_ok else 'ECART'}")
    elif lines:
        detail.append("Σ lignes: non vérifiable (ligne ou HT manquante)")
    if None not in (ht, tva, ttc):
        calc = round(ht + tva, 2)
        ttc_ok = abs(calc - ttc) <= tol
        detail.append(f"HT {ht} + TVA {tva} = {calc} vs TTC {ttc} → {'OK' if ttc_ok else 'ECART'}")
    else:
        detail.append("HT/TVA/TTC incomplets → TTC non vérifiable")
    checks = [c for c in (ht_ok, ttc_ok) if c is not None]
    sums_ok = (all(checks) if checks else None)
    return {"ht_ok": ht_ok, "ttc_ok": ttc_ok, "sums_ok": sums_ok, "detail": detail}


def run(data: dict, tol: float = TOLERANCE) -> dict:
    invoice, fails = normalize_invoice(data)
    sums = check_sums(invoice, tol)
    return {"invoice": invoice, "fails": fails, "sums": sums}


def main() -> int:
    if len(sys.argv) < 2 or not os.path.isfile(sys.argv[1]):
        print("usage: invoice_check.py <data.json>", file=sys.stderr)
        return 1
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    tol = float(os.environ.get("OCR_INVOICE_TOLERANCE") or TOLERANCE)
    print(json.dumps(run(data, tol), ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
