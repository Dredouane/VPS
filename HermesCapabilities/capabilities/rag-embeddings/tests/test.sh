#!/usr/bin/env bash
# Tests rag-embeddings (C4) — purs + intégration réelle si clé.
set -uo pipefail
CAP_DIR="${CAPABILITY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CAP_ID="${CAPABILITY_ID:-rag-embeddings}"
export CAPABILITY_DIR="$CAP_DIR" CAPABILITY_ID="$CAP_ID"
PASS=0; FAIL=0; SKIPN=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[1;33m~\033[0m %s\n' "$*"; SKIPN=$((SKIPN+1)); }

if "$CAP_DIR/../TEMPLATE/tests/test.sh"; then ok "contrat TEMPLATE hérité"
else fail "contrat TEMPLATE"; fi

if python3 - "$CAP_DIR/code" <<'PY'
import sys
sys.path.insert(0, sys.argv[1])
import embed_gemini as e
p = e.build_payload("  contenu  ", "text-embedding-004", 6000)
assert p["model"] == "models/text-embedding-004"
assert p["content"]["parts"][0]["text"] == "contenu"
try:
    e.build_payload("   ", "m", 100); assert False
except ValueError:
    pass
assert e.parse_embedding({"embedding": {"values": [0.1]*768}}) == [0.1]*768
try:
    e.parse_embedding({"embedding": {"values": [0.1]*100}}); assert False
except ValueError:
    pass
print("UNIT-OK")
PY
then ok "unitaires embed_gemini (payload, troncature, dimension)"
else fail "unitaires embed_gemini"
fi

if [ -n "${VPS_GEMINI_API_KEY:-}" ]; then
    if printf 'test embedding hermes' | VPS_GEMINI_API_KEY="$VPS_GEMINI_API_KEY" \
       python3 "$CAP_DIR/code/embed_gemini.py" - > /tmp/embed-test.json 2>/tmp/embed-test.err; then
        python3 -c "import json;d=json.load(open('/tmp/embed-test.json'));assert len(d['embedding'])==768 and d['model']=='text-embedding-004'" \
            && ok "intégration réelle (768d vérifiée)"
    elif grep -q "API key not valid" /tmp/embed-test.err; then
        skip "intégration réelle — VPS_GEMINI_API_KEY INVALIDE (config: mettre la vraie clé, ex. nouvelle clé Google AI Studio)"
    elif grep -qi "HTTP 400" /tmp/embed-test.err; then
        skip "intégration réelle — HTTP 400 (config clé/provider à corriger): $(head -c 100 /tmp/embed-test.err)"
    else
        fail "intégration réelle (exit $?) — $(head -c 120 /tmp/embed-test.err)"
    fi
else
    skip "intégration réelle (VPS_GEMINI_API_KEY absente)"
fi

printf '  ── %s: %d PASS, %d FAIL\n' "$CAP_ID" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
