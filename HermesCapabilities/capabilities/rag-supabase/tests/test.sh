#!/usr/bin/env bash
# Tests de la capability rag-supabase (C5).
# Hérite des tests de contrat TEMPLATE puis ajoute les checks spécifiques.
set -uo pipefail

CAP_DIR="${CAPABILITY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CAP_ID="${CAPABILITY_ID:-rag-supabase}"
export CAPABILITY_DIR="$CAP_DIR" CAPABILITY_ID="$CAP_ID"

PASS=0; FAIL=0; SKIPN=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[1;33m~\033[0m %s\n' "$*"; SKIPN=$((SKIPN+1)); }

# --- 1. Tests de contrat (TEMPLATE) ------------------------------------------
if "$CAP_DIR/../TEMPLATE/tests/test.sh"; then
    ok "contrat TEMPLATE hérité"
else
    fail "contrat TEMPLATE"
fi

# --- 2. Checks spécifiques C5 -------------------------------------------------
# mcp.json: référence uniquement le MCP 'supabase' + secrets par NOM (pas de valeur)
if grep -q '"name": "supabase"' "$CAP_DIR/mcp.json" && \
   grep -q '"SUPABASE_URL": "\${SUPABASE_URL}"' "$CAP_DIR/mcp.json" && \
   ! grep -qE '"(SUPABASE_(URL|KEY))":\s*"(eyJ|https)"' "$CAP_DIR/mcp.json"; then
    ok "mcp.json — supabase, secrets par référence"
else
    fail "mcp.json — config inattendue"
fi

# Jamais de service key (même mention recommandée négativement dans le code) :
# le manifest ne doit référencer QUE SUPABASE_URL + SUPABASE_RPC_KEY
for v in $(python3 -c "import yaml;print(' '.join(yaml.safe_load(open('$CAP_DIR/manifest.yaml')).get('secrets',[])))"); do
    case "$v" in
        SUPABASE_URL|SUPABASE_RPC_KEY) ok "secret déclaré conforme: $v" ;;
        *) fail "secret interdit pour C5: $v (service key interdite)" ;;
    esac
done

# skill.md: pas de SQL direct documenté, RPC dédiées présentes
if grep -q 'rpc_cap_<slug>_search' "$CAP_DIR/skill.md" && ! grep -qiE 'select \* from|delete from|insert into' "$CAP_DIR/skill.md"; then
    ok "skill.md — RPC dédiées, pas de SQL direct"
else
    fail "skill.md — SQL direct ou RPC manquante"
fi

# soul-addendum: interdiction service key + autres clients
if grep -qi "service" "$CAP_DIR/soul-addendum.md" && grep -qi "autres schémas\|autres clients" "$CAP_DIR/soul-addendum.md"; then
    ok "soul-addendum — refus C5 spécifiques"
else
    fail "soul-addendum — refus C5 incomplets"
fi

# --- 3. Test d'intégration VPS (SKIP hors VPS / sans secrets) -----------------
if command -v hermes >/dev/null 2>&1 && [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_RPC_KEY:-}" ]; then
    # Vérifier que le MCP supabase est installable depuis le catalogue
    if hermes mcp catalog 2>/dev/null | grep -q "^  supabase"; then
        ok "MCP supabase présent dans le catalogue"
    else
        fail "MCP supabase absent du catalogue (re-vérifier decision.md)"
    fi
else
    skip "test d'intégration (hermes/secrets absents — normal en local, exécuter sur VPS)"
fi

# --- Verdict ---
printf '  ── %s: %d PASS, %d FAIL\n' "$CAP_ID" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
