#!/usr/bin/env bash
# deploy.sh — Déploiement Alinea sur GCP Cloud Run (1 service : front + API)
# Usage : ./scripts/deploy.sh test|prod
# Pattern adapté du script de déploiement surenSaas (env file, BUILD_ID git,
# trap cleanup, nettoyage Artifact Registry keep-3) — adaptations : backend
# Node/Next (pas de Python), NEXT_PUBLIC_* au build time via .env.production,
# secrets sensibles via Secret Manager (--set-secrets).

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

ENV_NAME="${1:-}"
case "$ENV_NAME" in
  test|prod) ;;
  *) echo -e "${RED}❌ Usage : $0 test|prod${NC}"; exit 1 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$APP_DIR/.env.$ENV_NAME"
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ .env.$ENV_NAME non trouvé${NC}"
  echo "   Créez-le : cp $APP_DIR/.env.$ENV_NAME.example $ENV_FILE"
  exit 1
fi

echo -e "${BLUE}📋 Chargement de .env.$ENV_NAME...${NC}"
set -a
source "$ENV_FILE"
set +a

for VAR in GCP_PROJECT_ID GCP_REGION SERVICE_NAME \
           NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY \
           SUPABASE_SERVICE_KEY GEMINI_API_KEY \
           R2_S3_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  if [ -z "${!VAR:-}" ]; then
    echo -e "${RED}❌ Variable requise manquante : $VAR${NC}"
    exit 1
  fi
done

BUILD_ID=$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo "web-$(date +%s)")
echo -e "${BLUE}🔨 Build ID : $BUILD_ID${NC}"

SECRET_PROJECT="--project=$GCP_PROJECT_ID"

upsert_secret() {
  local NAME="$1" VALUE="$2"
  if gcloud secrets describe "$NAME" $SECRET_PROJECT >/dev/null 2>&1; then
    printf '%s' "$VALUE" | gcloud secrets versions add "$NAME" --data-file=- $SECRET_PROJECT --quiet >/dev/null
    echo -e "${GREEN}  ✅ secret mis à jour : $NAME${NC}"
  else
    printf '%s' "$VALUE" | gcloud secrets create "$NAME" --data-file=- $SECRET_PROJECT --quiet >/dev/null
    echo -e "${GREEN}  ✅ secret créé : $NAME${NC}"
  fi
}

echo -e "${YELLOW}🔐 Secrets (Secret Manager)...${NC}"
upsert_secret "alinea-supabase-service-key" "$SUPABASE_SERVICE_KEY"
upsert_secret "alinea-gemini-api-key" "$GEMINI_API_KEY"
upsert_secret "alinea-r2-access-key-id" "$R2_ACCESS_KEY_ID"
upsert_secret "alinea-r2-secret-access-key" "$R2_SECRET_ACCESS_KEY"

# NEXT_PUBLIC_* : inlinées au BUILD (pattern .env.production du projet surenSaas)
cd "$APP_DIR"
cat > apps/web/.env.production <<EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
EOF
cleanup() {
  if [ -f "$APP_DIR/apps/web/.env.production" ]; then
    rm -f "$APP_DIR/apps/web/.env.production"
    echo -e "${BLUE}🧹 .env.production supprimé${NC}"
  fi
}
trap cleanup EXIT

echo -e "${YELLOW}🚀 Déploiement Cloud Run ($ENV_NAME)...${NC}"
gcloud run deploy "$SERVICE_NAME" \
  --source "$APP_DIR" \
  --platform managed \
  --region "$GCP_REGION" \
  $SECRET_PROJECT \
  --allow-unauthenticated \
  --set-env-vars "BUILD_ID=$BUILD_ID,ENVIRONMENT=$ENV_NAME,NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY,R2_S3_ENDPOINT=$R2_S3_ENDPOINT,R2_BUCKET=$R2_BUCKET" \
  --set-secrets "SUPABASE_SERVICE_KEY=alinea-supabase-service-key:latest,GEMINI_API_KEY=alinea-gemini-api-key:latest,R2_ACCESS_KEY_ID=alinea-r2-access-key-id:latest,R2_SECRET_ACCESS_KEY=alinea-r2-secret-access-key:latest" \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --max-instances 5 \
  --min-instances 0 \
  --quiet

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$GCP_REGION" $SECRET_PROJECT --format 'value(status.url)')

echo -e "${YELLOW}🩺 Health check...${NC}"
sleep 5
HEALTH=$(curl -fsS "$SERVICE_URL/api/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo -e "${GREEN}✅ Health OK${NC}"
else
  echo -e "${YELLOW}⚠️  Health non vérifié : $HEALTH${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ ALINEA $ENV_NAME DÉPLOYÉ${NC}"
echo "=========================================="
echo -e "${BLUE}🌐 URL : $SERVICE_URL${NC}"
echo -e "${BLUE}🔧 Build : $BUILD_ID${NC}"
echo -e "${YELLOW}💡 Next.js build-time env : inlinées via .env.production (trap cleanup)${NC}"
echo ""

# Nettoyage Artifact Registry — garder les 3 images les plus récentes
echo -e "${YELLOW}🧹 Nettoyage Artifact Registry...${NC}"
REPOSITORY="$GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/cloud-run-source-deploy/$SERVICE_NAME"
if gcloud artifacts repositories describe "cloud-run-source-deploy" --location="$GCP_REGION" $SECRET_PROJECT >/dev/null 2>&1; then
  IMAGES=$(gcloud artifacts docker images list "$REPOSITORY" --sort-by="~UPDATE_TIME" --format="value(digest)" 2>/dev/null || echo "")
  if [ ! -z "$IMAGES" ]; then
    echo -e "${BLUE}  Images trouvées : $(echo "$IMAGES" | wc -l)${NC}"
    count=0
    for digest in $IMAGES; do
      if [ $count -ge 3 ]; then
        echo -e "${YELLOW}    Suppression : ${digest:0:20}...${NC}"
        gcloud artifacts docker images delete "$REPOSITORY@$digest" --quiet $SECRET_PROJECT >/dev/null 2>&1
      fi
      count=$((count+1))
    done
    echo -e "${GREEN}  ✅ 3 images conservées${NC}"
  fi
else
  echo -e "${YELLOW}  ⚠️  Dépôt Artifact Registry non trouvé${NC}"
fi
