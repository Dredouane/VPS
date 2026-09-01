#!/usr/bin/env bash
# Tests email-processing (C2) — thread_parser déterministe (purs, fixtures).
set -uo pipefail
CAP_DIR="${CAPABILITY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CAP_ID="${CAPABILITY_ID:-email-processing}"
export CAPABILITY_DIR="$CAP_DIR" CAPABILITY_ID="$CAP_ID"
PASS=0; FAIL=0; SKIPN=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[1;33m~\033[0m %s\n' "$*"; SKIPN=$((SKIPN+1)); }

if "$CAP_DIR/../TEMPLATE/tests/test.sh"; then ok "contrat TEMPLATE hérité"
else fail "contrat TEMPLATE"; fi

CODE="$CAP_DIR/code"; FIX="$CAP_DIR/tests/fixtures"
if python3 - "$CODE" "$FIX" <<'PY'
import sys, os, json
sys.path.insert(0, sys.argv[1])
import thread_parser as tp

fx = json.load(open(os.path.join(sys.argv[2], "spool_thread_fr.json")))

# --- parse complet sans known (tout nouveau, lazy backfill) -------------------
r = tp.parse_thread(fx)
assert r["thread_id"] == "1875124411713563599"
assert r["chain"]["messages_count"] == 3
assert r["chain"]["subject"] == "Demande de devis renovation"   # Tr:/Re: retirés
assert "dupont@example.com" in r["chain"]["participants"]
assert "arev@example.com" in r["chain"]["participants"]
assert r["chain"]["first_message_at"] is not None
assert r["stats"]["new"] == 3 and r["stats"]["known"] == 0

m1, m2, m3 = r["mails"]   # ordre chronologique
assert (m1["role"], m2["role"], m3["role"]) == ("nouveau", "reponse", "transfert")
assert m1["position"] == 1 and m3["position"] == 3

# m1: contenu nouveau intact, aucune quote
assert "demande de devis" in m1["new_content"].lower()
assert m1["quoted_segments"] == []
assert m1["attachments"][0]["filename"] == "plan-chantier.pdf"

# m2: quote FR "Le ... a écrit :" + ">" → séparées
assert "devis arrive en fin de semaine" in m2["new_content"]
assert m2["quoted_segments"] and "renovation pour un appartement" in m2["quoted_segments"][0]
assert m2["quoted_segments"][0].startswith("Le 30 août 2026 à 08:15")

# m3: transfert Outlook "----- Message d'origine -----" + "De :/Envoyé :"
assert m3["role"] == "transfert"
assert "transfer de notre conversation" in m3["new_content"].lower() or "conversation avec le syndic" in m3["new_content"].lower()
assert m3["quoted_segments"] and "syndic valide" in m3["quoted_segments"][0]

# --- statut RAG (known list fournie par l'orchestrateur) ----------------------
r2 = tp.parse_thread(fx, known_message_ids={"<msgA@example.com>"})
assert r2["mails"][0]["rag_status"] == "known"
assert r2["mails"][1]["rag_status"] == "new"
assert r2["stats"]["new"] == 2 and r2["stats"]["known"] == 1

# --- idempotence : re-parse d'un parse = même résultat (D3) -------------------
r3 = tp.parse_thread(json.loads(json.dumps(fx)))
assert r3 == r

# --- séparateurs EN + sujet normalisé idempotent ------------------------------
assert tp.normalize_subject("Re: Re: RE: Tr: Fwd: Sujet") == "Sujet"
assert tp.detect_role("Re: x", "", "", False) == "reponse"      # fallback sujet Re:
assert tp.detect_role("Nouveau sujet", "<ref@x>", "", False) == "reponse"
assert tp.detect_role("Nouveau sujet", "", "", True) == "reponse"  # quotes sans headers
print("UNIT-OK")
PY
then ok "unitaires thread_parser (roles, quotes FR/EN/Outlook, chain, rag_status, idempotence)"
else fail "unitaires thread_parser"
fi

skip "save DB chains/emails — exécuté par l'orchestrateur via RPC (testé dans supabase-sql.sh --smoke)"

printf '  ── %s: %d PASS, %d FAIL\n' "$CAP_ID" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
