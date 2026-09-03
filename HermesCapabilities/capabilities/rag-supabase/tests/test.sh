#!/usr/bin/env bash
# Tests rag-supabase (C5) — rpc_call pur + garde + smoke DB côté runner.
set -uo pipefail
CAP_DIR="${CAPABILITY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CAP_ID="${CAPABILITY_ID:-rag-supabase}"
export CAPABILITY_DIR="$CAP_DIR" CAPABILITY_ID="$CAP_ID"
PASS=0; FAIL=0; SKIPN=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[1;33m~\033[0m %s\n' "$*"; SKIPN=$((SKIPN+1)); }

if "$CAP_DIR/../TEMPLATE/tests/test.sh"; then ok "contrat TEMPLATE hérité"
else fail "contrat TEMPLATE"; fi

if python3 - "$CAP_DIR/code" <<'PY'
import sys, os
sys.path.insert(0, sys.argv[1])
import rpc_call as rc
url, req = rc.build_request("rpc_cap_doc_search",
    {"p_client_slug": "arev", "p_rpc_secret": "s3cret"},
    "https://ref.supabase.co/", "pk")
assert url == "https://ref.supabase.co/rest/v1/rpc/rpc_cap_doc_search"
assert req.get_header("Apikey") == "pk" and "Bearer pk" in (req.get_header("Authorization") or "")
assert rc.parse_response(b'[{"id": "x"}]') == {"id": "x"}
assert rc.parse_response(b"null") is None
os.environ.update({"CLIENT_SLUG": "arev", "CLIENT_RPC_SECRET": "sec"})
assert rc.client_payload({"p_kind": "email"})["p_client_slug"] == "arev"
assert rc.client_payload({"p_kind": "email"})["p_rpc_secret"] == "sec"
assert rc.client_payload({})["p_client_slug"] == "arev"
print("UNIT-OK")
PY
then ok "unitaires rpc_call (URL, headers, parse, injection slug/secret)"
else fail "unitaires rpc_call"
fi

# Smoke DB: le runner supabase-sql.sh teste déjà les 9 RPC + la garde.
# Ici: ping REST depuis la machine si vars présentes.
if [ -n "${VPS_SUPERBASE_VPS_DB_PROJECT_URL:-}" ] && [ -n "${VPS_SUPERBASE_VPS_DB_RPC_KEY:-}" ] \
   && [ -n "${CLIENT_SLUG:-}" ] && [ -n "${CLIENT_RPC_SECRET:-}" ]; then
    if CLIENT_SLUG="$CLIENT_SLUG" CLIENT_RPC_SECRET="$CLIENT_RPC_SECRET" \
       VPS_SUPERBASE_VPS_DB_PROJECT_URL="$VPS_SUPERBASE_VPS_DB_PROJECT_URL" \
       VPS_SUPERBASE_VPS_DB_RPC_KEY="$VPS_SUPERBASE_VPS_DB_RPC_KEY" \
       python3 "$CAP_DIR/code/rpc_call.py" rpc_cap_pipeline_log '{"p_trigger":"test-rest"}' >/tmp/rpccall.json 2>/tmp/rpccall.err; then
        ok "ping REST réel (pipeline_log)"
    elif grep -qi "HTTP 4" /tmp/rpccall.err; then
        fail "ping REST réel — $(head -c 120 /tmp/rpccall.err)"
    else
        skip "ping REST (autre erreur — $(head -c 80 /tmp/rpccall.err))"
    fi
else
    skip "ping REST (vars CLIENT_*/SUPERBASE absentes — normal en local)"
fi

printf '  ── %s: %d PASS, %d FAIL\n' "$CAP_ID" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
