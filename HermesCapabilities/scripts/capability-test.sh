#!/usr/bin/env bash
# capability-test.sh — Runner des tests unitaires des capabilities HermesCapabilities.
#
# Usage:
#   ./capability-test.sh [capability-id|all]     # local (contrat + tests sans secrets)
#   ./capability-test.sh <id> --vps              # (M2) tests d'intégration sur le VPS
#
# Sortie: PASS/FAIL par capability + verdict global (exit 0 si 0 FAIL).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPS_DIR="$BASE_DIR/capabilities"

TARGET="all"; VPS=0
for a in "$@"; do
    case "$a" in
        --vps) VPS=1 ;;
        -h|--help) grep '^#' "$0" | head -8; exit 0 ;;
        *) TARGET="$a" ;;
    esac
done

PASS=0; FAIL=0; SKIPN=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[1;33m~\033[0m %s\n' "$*"; SKIPN=$((SKIPN+1)); }

python3 -c "import yaml" 2>/dev/null || { echo "pyyaml requis (python3 -m pip install pyyaml)"; exit 1; }

if [ "$VPS" = "1" ]; then
    echo "Tests d'intégration VPS: à implémenter en M2 (ssh nemo + hermes + secrets test)."
    exit 0
fi

# Sélection des capabilities
shopt -s nullglob
if [ "$TARGET" = "all" ]; then
    DIRS=("$CAPS_DIR"/*/); [ ${#DIRS[@]} -gt 0 ] || DIRS=()
else
    [ -d "$CAPS_DIR/$TARGET" ] || { echo "Capability inconnue: $TARGET"; exit 1; }
    DIRS=("$CAPS_DIR/$TARGET")
fi
[ ${#DIRS[@]} -gt 0 ] || { echo "Aucune capability dans $CAPS_DIR"; exit 1; }

echo "════════════════════════════════════════════════════════"
echo " Tests HermesCapabilities — $(date '+%Y-%m-%d %H:%M') (local)"
echo "════════════════════════════════════════════════════════"

RESULT=0
for d in "${DIRS[@]}"; do
    cap="$(basename "$d")"
    echo
    echo "── Capability: $cap ──────────────────────────────────"

    # 1. Fichiers de contrat obligatoires
    for f in manifest.yaml decision.md soul-addendum.md tests/test.sh README.md; do
        if [ -f "$d/$f" ]; then ok "$cap/$f"; else fail "$cap/$f manquant"; RESULT=1; fi
    done

    # 2. Tests unitaires (self-reporting, exit 0 = ok)
    if [ -x "$d/tests/test.sh" ]; then
        if (cd "$d" && CAPABILITY_DIR="$d" CAPABILITY_ID="$cap" ./tests/test.sh); then
            ok "$cap/tests/test.sh"
        else
            fail "$cap/tests/test.sh"; RESULT=1
        fi
    else
        fail "$cap/tests/test.sh absent ou non exécutable"; RESULT=1
    fi
done

echo
echo "════════════════════════════════════════════════════════"
printf ' Résultat: \033[1;32m%d PASS\033[0m · \033[1;33m%d SKIP\033[0m · \033[1;31m%d FAIL\033[0m\n' "$PASS" "$SKIPN" "$FAIL"
echo "════════════════════════════════════════════════════════"
[ "$RESULT" -eq 0 ] && [ "$FAIL" -eq 0 ]
