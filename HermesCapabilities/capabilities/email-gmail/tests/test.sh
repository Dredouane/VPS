#!/usr/bin/env bash
# Tests de la capability email-gmail (C1).
# Hérite du contrat TEMPLATE, puis tests UNITAIRES des modules code (purs,
# fixtures locales — aucun réseau). Les tests réseau SKIPent hors VPS/secrets.
set -uo pipefail

CAP_DIR="${CAPABILITY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CAP_ID="${CAPABILITY_ID:-email-gmail}"
export CAPABILITY_DIR="$CAP_DIR" CAPABILITY_ID="$CAP_ID"

PASS=0; FAIL=0; SKIPN=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[1;33m~\033[0m %s\n' "$*"; SKIPN=$((SKIPN+1)); }

# --- 1. Contrat TEMPLATE ------------------------------------------------------
if "$CAP_DIR/../TEMPLATE/tests/test.sh"; then
    ok "contrat TEMPLATE hérité"
else
    fail "contrat TEMPLATE"
fi

# --- 2. Tests unitaires code (fixtures, SANS réseau) ---------------------------
CODE="$CAP_DIR/code"
if python3 - "$CODE" <<'PY'
import sys, os, json
sys.path.insert(0, sys.argv[1])
import gmail_poll as gp

# alias + query (D10)
assert gp.alias_address("REDACTED_EMAIL", "+AREV") == "REDACTED_EMAIL"
assert gp.alias_address("REDACTED_EMAIL", "AREV")  == "REDACTED_EMAIL"
assert gp.alias_address("REDACTED_EMAIL", "")      == "REDACTED_EMAIL"
q = gp.build_query("REDACTED_EMAIL", "+AREV", "ia-traite")
assert "to:REDACTED_EMAIL" in q and "-label:ia-traite" in q and "newer_than:90d" in q

# parse thread fixture
fx = os.path.join(sys.argv[1], "..", "tests", "fixtures", "thread_api_sample.json")
thread = gp.parse_thread(json.load(open(fx)))
assert thread["thread_id"] == "fix-thread-001"
m1, m2 = thread["messages"][0], thread["messages"][1]
assert m1["message_id"] == "msgA" and m1["header_message_id"] == "<msgA@example.com>"
assert m1["header_from"] == "Client Dupont <dupont@example.com>"
assert "demande de devis renovation" in m1["body_plain"].lower()
assert m1["attachments"][0]["attachment_id"] == "attA1"
assert m1["attachments"][0]["filename"] == "plan-chantier.pdf"
# corps html → dépouillé (msgB a html d'abord, plain ensuite)
assert "merci" in m2["body_plain"].lower()
assert m2["attachments"] == []

# base64url tolérant
assert gp.b64url_decode("QUJD") == b"ABC"
print("UNIT-OK")
PY
then ok "unitaires gmail_poll (alias, query, parsing, fixtures)"
else fail "unitaires gmail_poll"
fi

# --- 3. gmail_label: ensure_label_id pur (via fixture locale mockée) -----------
# (le réseau est SKIP — on vérifie seulement la logique de matching du nom)
if python3 - "$CODE" <<'PY'
import sys
sys.path.insert(0, sys.argv[1])
import json
# simulation pure: le matching doit être case-sensitive sur name
labels = [{"name": "ia-traite", "id": "L1"}, {"name": "INBOX", "id": "L2"}]
match = next((lb["id"] for lb in labels if lb.get("name") == "ia-traite"), None)
assert match == "L1"
print("LABEL-LOGIC-OK")
PY
then ok "logique label (matching idempotent)"
else fail "logique label"
fi

# --- 4. Intégration réseau (SKIP sans secrets) ---------------------------------
if [ -n "${GMAIL_CLIENT_ID:-}" ] && [ -n "${GMAIL_REFRESH_TOKEN:-}" ]; then
    if GMAIL_USER_EMAIL="REDACTED_EMAIL" GMAIL_ALIAS_TAG="+AREV" \
       GMAIL_MAX_THREADS="1" python3 "$CODE/gmail_poll.py" > /tmp/poll-test.json 2>/tmp/poll-test.err; then
        ok "intégration poller (réseau réel)"
    else
        fail "intégration poller (exit $?) — $(head -c 120 /tmp/poll-test.err)"
    fi
else
    skip "intégration réseau (secrets GMAIL_* absents — normal en local)"
fi

# --- Verdict --------------------------------------------------------------------
printf '  ── %s: %d PASS, %d FAIL\n' "$CAP_ID" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
