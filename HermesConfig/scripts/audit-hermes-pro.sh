#!/usr/bin/env bash
# audit-hermes-pro.sh — Audit santé/sécurité de la flotte HermesConfig (READ-ONLY).
# Usage: ./audit-hermes-pro.sh [slug]
# Sans argument: audite toutes les instances. Aucune modification, aucun secret affiché.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTANCES_DIR="$BASE_DIR/instances"
CLIENTS_DIR="$BASE_DIR/clients"

PASS=0; FAIL=0; WARN=0
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '\033[1;31m  ✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
warn() { printf '\033[1;33m  ~\033[0m %s\n' "$*"; WARN=$((WARN+1)); }

echo "════════════════════════════════════════════════════════"
echo " Audit HermesConfig — $(date '+%Y-%m-%d %H:%M') (read-only)"
echo "════════════════════════════════════════════════════════"

# --- 1. Instances ------------------------------------------------------------
shopt -s nullglob
INSTANCE_LIST=()
if [ $# -ge 1 ]; then
    [ -d "$INSTANCES_DIR/$1" ] && INSTANCE_LIST=("$1")
else
    for d in "$INSTANCES_DIR"/*/; do
        INSTANCE_LIST+=("$(basename "$d")")
    done
fi

if [ ${#INSTANCE_LIST[@]} -eq 0 ]; then
    warn "Aucune instance dans $INSTANCES_DIR — rien à auditer côté flotte pro"
fi

for SLUG in "${INSTANCE_LIST[@]}"; do
    echo
    echo "── Client: $SLUG ──────────────────────────────────────"
    COMPOSE="$INSTANCES_DIR/$SLUG/docker-compose.yml"
    DATA="$INSTANCES_DIR/$SLUG/data"

    if [ ! -f "$COMPOSE" ]; then warn "pas de compose (instance non déployée ?)"; continue; fi

    # Conteneur
    CT="hermes-$SLUG-pro"
    STATE=$(docker inspect -f '{{.State.Status}}' "$CT" 2>/dev/null || echo "absent")
    if [ "$STATE" = "running" ]; then ok "conteneur $CT: running"; else fail "conteneur $CT: $STATE"; fi

    # Health docker
    if [ "$STATE" = "running" ]; then
        H=$(docker inspect -f '{{.State.Health.Status}}' "$CT" 2>/dev/null || echo "n/a")
        case "$H" in
            healthy) ok "healthcheck docker: healthy" ;;
            starting) warn "healthcheck docker: starting (start_period ?)" ;;
            unhealthy) fail "healthcheck docker: unhealthy → docker logs $CT --tail 30" ;;
            *) warn "healthcheck docker: $H" ;;
        esac
    fi

    # Port loopback only
    PB=$(docker inspect -f '{{range $p,$_ := .NetworkSettings.Ports}}{{(index $_ 0).HostIp}}:{{(index $_ 0).HostPort}} {{end}}' "$CT" 2>/dev/null | tr -d ' ')
    if echo "$PB" | grep -q '^127\.0\.0\.1:'; then ok "port lié au loopback ($PB)"; else fail "port NON loopback: $PB"; fi

    # Image pinnée (pas latest)
    IMG=$(docker inspect -f '{{.Config.Image}}' "$CT" 2>/dev/null || echo "?")
    if echo "$IMG" | grep -q ':latest'; then fail "image non pinnée: $IMG"; else ok "image pinnée: $IMG"; fi

    # Fuite de secrets dans le compose généré
    if grep -Eq '(sk-[A-Za-z0-9]{10,}|[0-9]{6,12}:AA[A-Za-z0-9_-]{30,})' "$COMPOSE" 2>/dev/null; then
        fail "SECRET EN CLAIR dans $COMPOSE"
    else
        ok "compose sans secrets en clair (env_file)"
    fi

    # Perms env_file résolu (secrets.env)
    ENVF=$(grep -m1 -oP '(?<=- ).*(client|secrets)\.env' "$COMPOSE" 2>/dev/null || true)
    if [ -n "$ENVF" ] && [ -f "$ENVF" ]; then
        P=$(stat -c %a "$ENVF")
        [ "$P" = "600" ] && ok "env_file 600 ($ENVF)" || fail "env_file en $P (attendu 600): $ENVF"
    else
        warn "env_file (secrets.env) introuvable via compose"
    fi

    # Data dir
    if [ -d "$DATA" ]; then
        OWN=$(stat -c '%u:%g %a' "$DATA")
        [ "$OWN" = "10000:10000 700" ] && ok "data-dir $OWN" || warn "data-dir $OWN (attendu 10000:10000 700)"
    else
        warn "data-dir absent: $DATA"
    fi

    # Gateway connecté (Telegram)
    if [ -f "$DATA/gateway_state.json" ]; then
        if grep -qs '"state":"connected"' "$DATA/gateway_state.json"; then
            ok "gateway_state: connected"
        else
            fail "gateway_state: PAS connecté → vérifier token/409 (docker logs $CT)"
        fi
    else
        warn "gateway_state.json absent (premier boot ?)"
    fi

    # Vault mount
    VD=$(docker inspect -f '{{range .Mounts}}{{.Source}} {{end}}' "$CT" 2>/dev/null | tr ' ' '\n' | grep -m1 'HermesConfig' || true)
    if [ -n "$VD" ]; then
        ok "vault monté (scopé): $VD"
    else
        warn "aucun mount vault HermesConfig détecté"
    fi

    # Ressources
    MEM=$(docker inspect -f '{{.HostConfig.Memory}}' "$CT" 2>/dev/null || echo 0)
    [ "$MEM" -gt 0 ] 2>/dev/null && ok "mem_limit: $((MEM/1024/1024)) Mo" || warn "pas de mem_limit"
done

# --- 2. Hygiène globale -------------------------------------------------------
echo
echo "── Hygiène globale ─────────────────────────────────────"
# Fuite de secrets dans les .example versionnés
if grep -rEq '(sk-[A-Za-z0-9]{10,}|[0-9]{6,12}:AA[A-Za-z0-9_-]{30,})' \
    "$CLIENTS_DIR"/*/client.env.example "$BASE_DIR/hermes" 2>/dev/null; then
    fail "secret réel détecté dans un .example / hermes/ (à corriger avant commit)"
else
    ok "aucun secret réel dans les .example et hermes/"
fi
# .env présents localement (ne doivent pas être versionnés)
if ls "$CLIENTS_DIR"/*/client.env >/dev/null 2>&1 && [ -d "$BASE_DIR/../.git" ]; then
    if git -C "$BASE_DIR/.." check-ignore -q "$CLIENTS_DIR/TEMPLATE/client.env" 2>/dev/null \
       || git -C "$BASE_DIR/.." check-ignore -q "$CLIENTS_DIR/arev/client.env" 2>/dev/null; then
        ok "*.env couverts par .gitignore"
    else
        warn "vérifier .gitignore: *.env doit être ignoré"
    fi
fi
# Conteneurs hermes hors HermesConfig (visibilité flotte complète)
EXTRA=$(docker ps --format '{{.Names}}' 2>/dev/null | grep '^hermes-' | grep -v -- '-pro$' | tr '\n' ' ')
[ -n "$EXTRA" ] && warn "flotte v1 hors HermesConfig: $EXTRA (périmètre spawn-hermes.sh historique)" || ok "aucun conteneur hors périmètre"
# Disque
DF=$(df -h / | awk 'NR==2{print $5}')
[ "${DF%\%}" -lt 85 ] 2>/dev/null && ok "disque /: $DF utilisé" || fail "disque /: $DF utilisé (seuil 85%)"

echo
echo "════════════════════════════════════════════════════════"
printf ' Résultat: \033[1;32m%d OK\033[0m · \033[1;33m%d warn\033[0m · \033[1;31m%d FAIL\033[0m\n' "$PASS" "$WARN" "$FAIL"
echo "════════════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]
