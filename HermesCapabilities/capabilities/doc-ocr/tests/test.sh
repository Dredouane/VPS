#!/usr/bin/env bash
# Tests doc-ocr (C3) — juge général, normalisation, check montants (purs),
# adaptateur (prompt/validation purs). Réseau = SKIP sans clés.
set -uo pipefail
CAP_DIR="${CAPABILITY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CAP_ID="${CAPABILITY_ID:-doc-ocr}"
export CAPABILITY_DIR="$CAP_DIR" CAPABILITY_ID="$CAP_ID"
PASS=0; FAIL=0; SKIPN=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[1;33m~\033[0m %s\n' "$*"; SKIPN=$((SKIPN+1)); }

if "$CAP_DIR/../TEMPLATE/tests/test.sh"; then ok "contrat TEMPLATE hérité"
else fail "contrat TEMPLATE"; fi

CODE="$CAP_DIR/code"
if python3 - "$CODE" <<'PY'
import sys, os, json
sys.path.insert(0, sys.argv[1])
import ocr_judge as j, ocr_gemini as g, invoice_check as ic, invoice_adapter as ia

# ── juge général ─────────────────────────────────────────────────────────────
ex1 = {"extractor": "gemini", "doc_type_hint": "facture", "confidence": 0.9,
       "text": "FACTURE FA-2026-001\nTotal HT 120,00 EUR\nTVA 24,00\nTotal TTC 144,00\nEcheance 30/09/2026"}
ex2 = {"extractor": "openrouter", "doc_type_hint": "facture", "confidence": 0.85,
       "text": "FACTURE FA-2026-001\nTotal HT 120,00 EUR\nTVA 24,00\nTotal TTC 144,00\nEcheance 30/09/2026"}
v = j.judge(ex1, ex2)
assert v["agreement"] == 1.0 and v["doc_type"] == "facture"
assert v["winner"] in ("gemini", "openrouter") and not v["low_agreement"]

# désaccord fort → low_agreement + confiance réduite
ex3 = dict(ex2, text="Le chantier avance bien, photos en piece jointe.", doc_type_hint="photo", confidence=0.8)
v2 = j.judge(ex1, ex3)
assert v2["low_agreement"] is True and v2["confidence"] <= 0.7

# doc_type : désaccord de hints tranché par heuristique (facture)
assert j.decide_doc_type(ex1, ex3) == "facture"
assert j.decide_doc_type({"doc_type_hint": "plan", "text": "plan masse", "confidence": 0.5},
                         {"doc_type_hint": "plan", "text": "plan masse 2", "confidence": 0.4}) == "plan"

# heuristique facture : mots + montants
assert j.heuristic_facture(ex1["text"]) is True
assert j.heuristic_facture("bonjour, merci pour le chantier") is False

# ── normalisation nombres FR/EN ──────────────────────────────────────────────
n = ic.normalize_number
assert n("1 234,56") == 1234.56 and n("1,234.56") == 1234.56
assert n("1.234,56") == 1234.56 and n("1234.56") == 1234.56
assert n("\u00a0120,00\u00a0\u20ac") == 120.0 and n("-5,50") == -5.5
assert n("abc") is None and n("") is None and n(None) is None

# ── normalisation facture (aliases) ──────────────────────────────────────────
inv, fails = ic.normalize_invoice({
    "No": "FA-1", "Emetteur": "SARL X", "Date": "30/08/2026",
    "Total HT": "120,00", "TVA": "24,00", "Montant total": "144,00",
    "items": [{"libelle": "pose", "prix": "100,00"}, {"libelle": "fournitures", "prix": "20,00"}],
})
assert inv["numero"] == "FA-1" and inv["fournisseur"] == "SARL X"
assert inv["montant_ht"] == 120.0 and inv["montant_ttc"] == 144.0
assert len(inv["lignes"]) == 2 and inv["lignes"][0]["montant"] == 100.0
assert fails == []

# ── check montants : OK / ÉCART / non vérifiable ─────────────────────────────
s = ic.check_sums(inv)
assert s["sums_ok"] is True and s["ht_ok"] and s["ttc_ok"], s
inv_bad, _ = ic.normalize_invoice({"Total HT": "120,00", "TVA": "24,00", "Montant total": "150,00"})
s2 = ic.check_sums(inv_bad)
assert s2["sums_ok"] is False and s2["ttc_ok"] is False
inv_part, _ = ic.normalize_invoice({"Total HT": "120,00"})
s3 = ic.check_sums(inv_part)
assert s3["sums_ok"] is None   # non vérifiable — jamais inventé

# ── adaptateur : prompt + parsing purs ───────────────────────────────────────
schema = ia.load_schema()
p = ia.build_prompt("FACTURE FA-1 TOTAL 144", schema)
assert "FA-1" in p and "numero" in p and "N'invente JAMAIS" in p
assert ia.parse_adapter_output('{"numero": "FA-1"}') == {"numero": "FA-1"}
assert ia.parse_adapter_output("pas du json") is None

print("UNIT-OK")
PY
then ok "unitaires doc-ocr (juge, nombres FR/EN, aliases, sommes, adaptateur)"
else fail "unitaires doc-ocr"
fi

# Intégration réseau (vision réelle) : nécessite clés + une image — test réel
# à M2.6 sur vraie PJ. Ici SKIP propre.
if [ -n "${VPS_GEMINI_API_KEY:-}" ] && [ -n "${VPS_OPEN_ROUTER_API_KEY:-}" ]; then
    skip "intégration vision réelle: clés présentes mais fixture image coûteuse — test à M2.6"
else
    skip "intégration réseau (clés GEMINI/OPENROUTER absentes — normal en local)"
fi

printf '  ── %s: %d PASS, %d FAIL\n' "$CAP_ID" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
