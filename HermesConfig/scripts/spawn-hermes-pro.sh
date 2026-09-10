#!/usr/bin/env bash
# spawn-hermes-pro.sh — Déploie un agent Hermes pro dockerisé pour un client.
# HermesConfig v2 — remplace spawn-hermes.sh pour les clients PME.
#
# Usage:
#   sudo ./spawn-hermes-pro.sh <slug> [--port N] [--force-config]
#
# Exemples:
#   sudo ./spawn-hermes-pro.sh arev
#   sudo ./spawn-hermes-pro.sh arev --port 8654
#
# Pré-requis:
#   - clients/<slug>/client.env renseigné (tokens, users, clé LLM) — mode 600
#   - clients/<slug>/soul.md adapté au client
#   - image hermes-agent taggée (pinnée) OU hermes-agent:latest buildée
#   - à exécuter en root (chown data/vault, ACL) — secrets jamais affichés
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$BASE_DIR/docker/docker-compose.yml.template"
CONFIG_EXAMPLE="$BASE_DIR/hermes/config.yaml.example"
INSTANCES_DIR="$BASE_DIR/instances"
HERMES_REPO="${HERMES_REPO:-/home/admin/hermes-fleet/hermes-repo}"
DEFAULT_IMAGE_TAG="${HERMES_IMAGE_TAG:-v2026.5.16-522}"
VAULT_ROOT="/home/syncthing/obsidian-vault/VPS/HermesConfig"
PORT_AUTO_START="${HERMES_PRO_PORT_START:-8654}"

FORCE_CONFIG=0
SLUG=""
while [ $# -gt 0 ]; do
    case "$1" in
        --port) FORCE_PORT="$2"; shift 2 ;;
        --force-config) FORCE_CONFIG=1; shift ;;
        -h|--help) grep '^#' "$0" | head -12; exit 0 ;;
        *) SLUG="$1"; shift ;;
    esac
done

log()  { printf '\033[1;34m[spawn]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ ok ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "À exécuter en root (chown data/vault + ACL). Secrets: /etc/secrets/ + clients/<slug>/client.env"
[ -n "$SLUG" ] || die "Usage: $0 <slug> [--port N] [--force-config]"
echo "$SLUG" | grep -Eq '^[a-z0-9][a-z0-9_-]*$' || die "Slug invalide: '$SLUG' (a-z0-9_-)"
[ -f "$TEMPLATE" ] || die "Template introuvable: $TEMPLATE"
[ -f "$CONFIG_EXAMPLE" ] || die "Config exemple introuvable: $CONFIG_EXAMPLE"

# Chemins d'instance (définis tôt — utilisés par l'idempotence de port §3)
INSTANCE_DIR="$INSTANCES_DIR/$SLUG"
DATA_DIR="$INSTANCE_DIR/data"
VAULT_CLIENT_DIR="$VAULT_ROOT/$SLUG"

# --- 1. Fichiers client ------------------------------------------------------
CLIENT_DIR="$BASE_DIR/clients/$SLUG"
ENV_FILE="$CLIENT_DIR/client.env"
SOUL_FILE="$CLIENT_DIR/soul.md"
[ -f "$ENV_FILE" ] || die "Absent: $ENV_FILE (cp -r clients/TEMPLATE clients/$SLUG puis renseigner)"
[ -f "$SOUL_FILE" ] || die "Absent: $SOUL_FILE (contrat sait/peut/refuse — obligatoire)"

CURRENT_PERM=$(stat -c %a "$ENV_FILE")
if [ "$CURRENT_PERM" != "600" ]; then
    chmod 600 "$ENV_FILE"
    warn "client.env passé de $CURRENT_PERM à 600"
fi

# Chargement dans un sous-shell: aucune valeur n'est jamais affichée.
# Fallback: DEEPSEEK_API_KEY peut venir de /etc/secrets/hermes.env (env root)
# si absente du client.env.
if [ -f /etc/secrets/hermes.env ]; then
    set -a
    # shellcheck disable=SC1091
    . /etc/secrets/hermes.env
    set +a
fi
INHERITED_DEEPSEEK_KEY="${DEEPSEEK_API_KEY:-}"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN manquant dans client.env}"
: "${TELEGRAM_ALLOWED_USERS:?TELEGRAM_ALLOWED_USERS manquant dans client.env}"
[ -n "${DEEPSEEK_API_KEY:-}" ] || DEEPSEEK_API_KEY="$INHERITED_DEEPSEEK_KEY"
: "${DEEPSEEK_API_KEY:?DEEPSEEK_API_KEY absente (client.env ou /etc/secrets/hermes.env)}"
: "${HERMES_MODEL_PROVIDER:=deepseek}"
: "${HERMES_MODEL:=deepseek-chat}"
[ "${CLIENT_SLUG:-}" = "$SLUG" ] || warn "CLIENT_SLUG (${CLIENT_SLUG:-vide}) != slug '$SLUG' (cosmétique, le slug commande)"

# --- 2. Image pinnée ---------------------------------------------------------
IMAGE_TAG="${HERMES_IMAGE_TAG:-$DEFAULT_IMAGE_TAG}"
IMAGE="hermes-agent:$IMAGE_TAG"
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
    ok "Image pinnée présente: $IMAGE"
elif docker image inspect hermes-agent:latest >/dev/null 2>&1; then
    docker tag hermes-agent:latest "$IMAGE"
    ok "Image taggée depuis latest: $IMAGE (vérifier la version avant prod!)"
else
    [ -f "$HERMES_REPO/Dockerfile" ] || die "Image $IMAGE absente et pas de Dockerfile dans $HERMES_REPO"
    log "Build de l'image depuis $HERMES_REPO (long)…"
    docker build -t "$IMAGE" "$HERMES_REPO"
fi

# --- 3. Port -----------------------------------------------------------------
PORT="${FORCE_PORT:-}"
if [ -z "$PORT" ] && [ -f "$INSTANCE_DIR/docker-compose.yml" ]; then
    PORT=$(grep -oP '127\.0\.0\.1:\K[0-9]+' "$INSTANCE_DIR/docker-compose.yml" | head -1)
    [ -n "$PORT" ] && ok "Port existant conservé: $PORT (idempotent)"
fi
if [ -z "$PORT" ]; then
    PORT="$PORT_AUTO_START"
    while ss -tuln 2>/dev/null | grep -q ":$PORT " || docker ps --format '{{.Ports}}' 2>/dev/null | grep -q ":$PORT->"; do
        PORT=$((PORT + 1))
    done
fi
ok "Port: 127.0.0.1:$PORT → 8642"

# --- 4. Répertoires ----------------------------------------------------------
mkdir -p "$DATA_DIR"
chown -R 10000:10000 "$DATA_DIR"
chmod 700 "$DATA_DIR"

mkdir -p "$VAULT_CLIENT_DIR"
chown 10000:10000 "$VAULT_CLIENT_DIR"
chmod 775 "$VAULT_CLIENT_DIR"
if command -v setfacl >/dev/null 2>&1; then
    setfacl -m u:syncthing:rwx "$VAULT_CLIENT_DIR" 2>/dev/null \
        && setfacl -d -m u:syncthing:rwx "$VAULT_CLIENT_DIR" 2>/dev/null \
        && ok "Vault client: $VAULT_CLIENT_DIR (ACL syncthing rw)" \
        || warn "setfacl syncthing échoué — la synchro de ce dossier peut être en lecture seule"
else
    warn "setfacl absent — syncthing ne pourra pas écrire dans $VAULT_CLIENT_DIR (sync dégradée)"
fi

# --- 5. config.yaml + SOUL.md dans le data-dir -------------------------------
if [ ! -f "$DATA_DIR/config.yaml" ] || [ "$FORCE_CONFIG" = "1" ]; then
    sed -e "s/__MODEL_PROVIDER__/${HERMES_MODEL_PROVIDER}/g" \
        -e "s/__MODEL__/${HERMES_MODEL}/g" \
        "$CONFIG_EXAMPLE" > "$DATA_DIR/config.yaml"
    chown 10000:10000 "$DATA_DIR/config.yaml"
    chmod 640 "$DATA_DIR/config.yaml"
    ok "config.yaml pro installé (redact_secrets, model ${HERMES_MODEL_PROVIDER}/${HERMES_MODEL})"
else
    ok "config.yaml existant conservé (--force-config pour écraser)"
fi
if [ ! -f "$DATA_DIR/SOUL.md" ]; then
    install -o 10000 -g 10000 -m 640 "$SOUL_FILE" "$DATA_DIR/SOUL.md"
    ok "SOUL.md installé"
else
    ok "SOUL.md existant conservé"
fi

# --- 6. Rendu du compose + secrets.env ---------------------------------------
# secrets.env = PASS-THROUGH COMPLET de client.env (v2.1 — D11/I11 étendu) :
# toutes les vars du client (Telegram, LLM, capabilities VPS_*) arrivent au
# conteneur via env_file — les secrets n'apparaissent jamais dans le YAML,
# la CLI ou git. 600, hors git.
SECRETS_FILE="$INSTANCE_DIR/secrets.env"
umask 077
{
    echo "# Généré par spawn-hermes-pro.sh le $(date '+%Y-%m-%d %H:%M') — pass-through client.env"
    grep -vE '^[[:space:]]*(#|$)' "$ENV_FILE" | sed 's/\r$//'
} > "$SECRETS_FILE"
chmod 600 "$SECRETS_FILE"

COMPOSE="$INSTANCE_DIR/docker-compose.yml"
sed -e "s|__SLUG__|${SLUG}|g" \
    -e "s|__PORT__|${PORT}|g" \
    -e "s|__IMAGE__|${IMAGE}|g" \
    -e "s|__CLIENTS_DIR__|${CLIENT_DIR}|g" \
    -e "s|__INSTANCE_DIR__|${INSTANCE_DIR}|g" \
    -e "s|__DATA_DIR__|${DATA_DIR}|g" \
    -e "s|__VAULT_CLIENT_DIR__|${VAULT_CLIENT_DIR}|g" \
    -e "s|__DATE__|$(date '+%Y-%m-%d %H:%M')|g" \
    "$TEMPLATE" > "$COMPOSE"
chmod 600 "$COMPOSE"
# Garde-fou anti-fuite: aucun secret ne doit apparaître dans le YAML généré
if grep -Eq '(sk-[A-Za-z0-9]{10,}|[0-9]{6,12}:AA[A-Za-z0-9_-]{30,})' "$COMPOSE"; then
    die "Fuite détectée: secret en clair dans $COMPOSE — corriger le template/client.env"
fi
ok "Compose généré: $COMPOSE (600, sans secrets) + secrets.env (600)"

# --- 7. Déploiement -----------------------------------------------------------
log "docker compose up -d (container: hermes-$SLUG-pro)…"
docker compose -f "$COMPOSE" up -d

# --- 7bis. Requirements Python (deps du pipeline) ----------------------------
REQ_SRC="$BASE_DIR/hermes/requirements.txt"
REQ_DST="$DATA_DIR/requirements.txt"
if [ -f "$REQ_SRC" ]; then
    install -o 10000 -g 10000 -m 640 "$REQ_SRC" "$REQ_DST"
    docker exec "hermes-$SLUG-pro" /opt/hermes/.venv/bin/python -m pip install -q -r /opt/data/requirements.txt 2>&1 | tail -3
    ok "Requirements Python installés (openpyxl/docx/pptx)"
else
    warn "requirements.txt absent ($REQ_SRC) — deps non installées"
fi

# --- 8. Vérification santé ----------------------------------------------------
# L'API 8642 ne tourne pas en gateway headless → on vérifie le state file
# (gateway running + Telegram connecté), la source de vérité.
log "Attente de la connexion Telegram (max ~90 s)…"
HEALTHY=0
for _ in $(seq 1 30); do
    if docker exec "hermes-$SLUG-pro" grep -qs '"state":"connected"' /opt/data/gateway_state.json 2>/dev/null; then
        HEALTHY=1; break
    fi
    sleep 3
done
if [ "$HEALTHY" = "1" ]; then
    ok "Telegram connecté (gateway_state.json)"
else
    warn "Pas encore connecté — vérifier: docker logs hermes-$SLUG-pro --tail 50"
fi

echo
ok "━━━ Agent '$SLUG' déployé ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf '  Conteneur : hermes-%s-pro (image %s)\n' "$SLUG" "$IMAGE"
printf '  API       : http://127.0.0.1:%s (loopback only — API headless non active)\n' "$PORT"
printf '  Data      : %s (10000:10000, 700)\n' "$DATA_DIR"
printf '  Vault     : %s → /opt/vault\n' "$VAULT_CLIENT_DIR"
printf '  Secrets   : %s (600) + %s (600, hors git)\n' "$ENV_FILE" "$SECRETS_FILE"
printf '  Audit     : %s/audit-hermes-pro.sh\n' "$SCRIPT_DIR"
printf '  Telegram  : état connecté attendu sous ~60 s (gateway_state.json)\n'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
