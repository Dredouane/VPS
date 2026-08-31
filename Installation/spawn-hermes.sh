#!/usr/bin/env bash
set -e

AGENT_NAME="$1"
BOT_TOKEN="$2"

if [ -z "$AGENT_NAME" ]; then
    echo "❌ Usage: ./spawn-hermes.sh <nom_agent> [telegram_bot_token]"
    exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$REPO_DIR/$AGENT_NAME"
HERMES_REPO="$REPO_DIR/hermes-repo"

# Vérification du dossier hermes-repo pour le build
if [ -d "$HERMES_REPO" ] && [ -f "$HERMES_REPO/Dockerfile" ]; then
    echo "🏗️ Build de l'image Docker depuis $HERMES_REPO..."
    docker build -t hermes-agent:latest "$HERMES_REPO"
elif docker image inspect hermes-agent:latest >/dev/null 2>&1; then
    echo "ℹ️ Utilisation de l'image 'hermes-agent:latest' existante..."
else
    echo "❌ Erreur: L'image 'hermes-agent:latest' n'existe pas et aucun Dockerfile n'a été trouvé."
    exit 1
fi

# Recherche automatique d'un port disponible à partir de 8650
find_free_port() {
    local port=8650
    while netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; do
        ((port++))
    done
    echo "$port"
}

AGENT_PORT=$(find_free_port)

DEEPSEEK_KEY="${DEEPSEEK_API_KEY:-""}"
USER_ID="${TELEGRAM_USER_ID:-""}"

echo "🚀 Création de l'agent Hermes: $AGENT_NAME (Port attribué : $AGENT_PORT)..."

mkdir -p "$BASE_DIR/data"
chown -R 10000:10000 "$BASE_DIR/data" && chmod -R 700 "$BASE_DIR/data"

# === NOUVEAU : Vérification du vault Obsidian ===
VAULT_PATH="/home/syncthing/obsidian-vault"
if [ ! -d "$VAULT_PATH" ]; then
    echo "⚠️  Attention: Le vault Obsidian n'existe pas à $VAULT_PATH"
    echo "   Le montage sera ignoré."
    VAULT_MOUNT=""
else
    echo "📂 Vault Obsidian trouvé: $VAULT_PATH"
    VAULT_MOUNT="- /home/syncthing/obsidian-vault:/opt/vault"
fi

LEAN_ATLAS_PATH="/home/syncthing/obsidian-vault/LeanConstruction/Lean-Cognitive-Atlas"
if [ -d "$LEAN_ATLAS_PATH" ]; then
    echo "📂 Lean-Cognitive-Atlas trouvé: $LEAN_ATLAS_PATH"
    LEAN_ATLAS_MOUNT="- /home/syncthing/obsidian-vault/LeanConstruction/Lean-Cognitive-Atlas:/opt/vault/lean-cognitive-atlas"
else
    LEAN_ATLAS_MOUNT=""
fi

cat <<DOCKEREOF > "$BASE_DIR/docker-compose.yml"
services:
  hermes-$AGENT_NAME:
    image: hermes-agent:latest
    container_name: hermes-$AGENT_NAME
    restart: unless-stopped
    command:
      - gateway
      - run
      - --replace
    dns:
      - 8.8.8.8
      - 1.1.1.1
    ports:
      - "$AGENT_PORT:8642"
    volumes:
      - ./data:/opt/data
      ${VAULT_MOUNT}
      ${LEAN_ATLAS_MOUNT}
    environment:
      - HERMES_AGENT_NAME=$AGENT_NAME
      - DEEPSEEK_API_KEY=${DEEPSEEK_KEY}
      - HERMES_MODEL_PROVIDER=deepseek
      - HERMES_MODEL=deepseek-chat
      - TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
      - TELEGRAM_ALLOWED_USERS=${USER_ID}
      - HERMES_DASHBOARD=0
      - HERMES_MODE=gateway
      - TELEGRAM_FALLBACK_IPS=149.154.167.220
      # === NOUVEAU : Variables pour le vault ===
      - HERMES_VAULT_DIR=/opt/vault
      - HERMES_LEAN_ATLAS=/opt/vault/lean-cognitive-atlas
      - OBSIDIAN_VAULT_PATH=/opt/vault
DOCKEREOF

cd "$BASE_DIR"
docker compose down -v 2>/dev/null || true
docker compose up -d

echo "✅ Agent $AGENT_NAME déployé avec succès sur le port $AGENT_PORT !"
