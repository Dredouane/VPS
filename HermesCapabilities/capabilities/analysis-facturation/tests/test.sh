#!/usr/bin/env bash
# Tests analysis-facturation (C6) — contrat (RPC testées côté supabase-sql smoke).
set -uo pipefail
CAP_DIR="${CAPABILITY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CAP_ID="${CAPABILITY_ID:-analysis-facturation}"
export CAPABILITY_DIR="$CAP_DIR" CAPABILITY_ID="$CAP_ID"
PASS=0; FAIL=0; SKIPN=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }

if "$CAP_DIR/../TEMPLATE/tests/test.sh"; then ok "contrat TEMPLATE hérité"
else fail "contrat TEMPLATE"; fi

# Les deux skills experts existent (skills/<id>.md) avec frontmatter + règles
for f in skills/expert-router.md skills/expert-facturation.md; do
    if grep -q "^name:" "$CAP_DIR/$f" && grep -qi "refuse\|strictement\|JAMAIS" "$CAP_DIR/$f"; then
        ok "$f (expert défini avec règles)"
    else fail "$f (expert incomplet)"; fi
done

# Règles non négociables présentes (D6)
if grep -q "numero" "$CAP_DIR/skills/expert-facturation.md" && grep -qi "valide" "$CAP_DIR/skills/expert-facturation.md" \
   && grep -qi "SQL direct" "$CAP_DIR/skills/expert-facturation.md"; then
    ok "règles facture: numero requis, statut humain protégé, pas de SQL direct"
else fail "règles facture incomplètes"; fi

printf '  ── %s: %d PASS, %d FAIL\n' "$CAP_ID" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
