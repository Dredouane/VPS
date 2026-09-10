# 🔄 SPINOFF_ONBOARDING.md — Déployer un nouveau client PME (end-to-end)

> Procédure d'onboarding d'un **nouveau client PME** sur la fabrique Hermes.
> Implique **2 sessions opencode** (VPS + Pipeline) et **2 sous-projets**.
> Le pattern est déjà validé avec le client `arev` (01/09/2026).
> Après, un nouveau client = `TEMPLATE` + les 6 étapes ci-dessous.

---

## 0. Credentials — bashrc local (préfixe `VPS_*`)

Les clés par client (bashrc local, jamais commité) :

```bash
export VPS_GMAIL_RECEPTION_IMAP_ADRESS="REDACTED_EMAIL"   # boîte partagée multi-clients
export VPS_GMAIL_RECEPTION_IMAP_MDP="<app password IMAP>"
export VPS_GEMINI_API_KEY="<clé Google AI Studio valide>"
export VPS_OPEN_ROUTER_API_KEY="<clé OpenRouter>"
export VPS_SUPERBASE_VPS_DB_URL="REDACTED_DB_URL"
export VPS_SUPERBASE_VPS_DB_PROJECT_URL="https://<ref>.supabase.co"
export VPS_SUPERBASE_VPS_DB_RPC_KEY="<publishable key>"
export VPS_DEEP_SEEK_API_KEY="<clé deepseek>"
export VPS_GED_CLOUDFLARE_S3_EU_ENDPOINT="https://<account>.eu.r2.cloudflarestorage.com"
export VPS_GED_CLOUDFLARE_BUCKET_NAME="<bucket>"
export VPS_GED_CLOUDFLARE_ACCESS_KEY_ID="<key id>"
export VPS_GED_CLOUDFLARE_SECRET_ACCESS_KEY="<secret>"
export VPS_GED_CLOUDFLARE_TOKEN="<token API REST — NON pour S3>"
export VPS_TELEGRAM_BOT_TOKEN="<nouveau bot @BotFather pour ce client>"
```

> Référence complète des vars : `HermesCapabilities/DEPLOYMENT.md` §3.
> `DEEPSEEK_API_KEY` (nom natif Hermes) ne se renomme pas.

## 1. Container Hermes — `HermesConfig/` (session VPS)

```bash
# 1a. Copier le TEMPLATE et renseigner les credentials
cd HermesConfig
cp -r clients/TEMPLATE clients/<slug>
vim clients/<slug>/client.env          # TOKEN_BOT, ALLOWED_USERS, DEEPSEEK, keys VPS_*
cp clients/<slug>/soul.md              # adapter le contrat (sait/peut/refuse)
chmod 600 clients/<slug>/client.env

# 1b. Déployer le conteneur (idempotent)
sudo ./scripts/spawn-hermes-pro.sh <slug>

# 1c. Créer le bot Telegram
# @BotFather → /newbot → nom client → récupérer TELEGRAM_BOT_TOKEN (à mettre dans client.env)
```

## 2. SQL migrations + registry — `HermesCapabilities/` (pipeline session)

```bash
# 2a. Sync les 2 sous-projets (y compris HermesCapabilities/i vers le VPS)
rsync -av --exclude 'instances/' --exclude '*.env' \
  ~/dev/VPS/HermesConfig/ ~/dev/VPS/HermesCapabilities/ nemo:/tmp/sync/
ssh nemo 'sudo rsync -a /tmp/sync/HermesConfig/ /home/admin/hermes-fleet/HermesConfig/ \
  && sudo rsync -a /tmp/sync/HermesCapabilities/ /home/admin/hermes-fleet/HermesCapabilities/ \
  && sudo rm -rf /tmp/sync'

# 2b. SQL migrations (le runner auto-déclare le client dans cap_clients)
ssh nemo 'cd /home/admin/hermes-fleet/HermesCapabilities \
  && sudo ./scripts/supabase-sql.sh <slug> all --smoke --yes \
  && sudo ./scripts/supabase-sql.sh <slug> status'
# → attendu: N migrations appliquées, smoke 100 %, client "<slug>" déclaré
```

> Le runner auto-génère `CLIENT_RPC_SECRET` (24 hex) et l'écrit dans
> `HermesConfig/clients/<slug>/client.env` (600). Ne pas créer à la main.

## 3. Attach des capabilities — `HermesCapabilities/` (pipeline session)

```bash
ssh nemo 'cd /home/admin/hermes-fleet/HermesCapabilities \
  && sudo ./scripts/capability-attach.sh <slug> email-gmail email-processing \
      doc-ocr rag-embeddings rag-supabase analysis-facturation ged-r2 --dry-run'
# dry-run: vérifier les secrets, plan d'accumulation, capabilities.yaml

ssh nemo 'cd /home/admin/hermes-fleet/HermesCapabilities \
  && sudo ./scripts/capability-attach.sh <slug> email-gmail email-processing \
      doc-ocr rag-embeddings rag-supabase analysis-facturation ged-r2'
# → skills montés dans data/skills/, code dans data/code/, soul mergé,
#   r2_key metadata prête, state capabilities.yaml mis à jour
```

## 4. Routine email-poll (cron Hermes, exécutée par le scheduler default profile)

```bash
sudo docker exec -u 10000 hermes-<slug>-pro /opt/hermes/.venv/bin/hermes cron create \
  "*/10 8-19 * * *" \
  "Exécuter le pipeline email: python3 /opt/data/code/email-processing/run_pipeline.py \
   --max-threads 5 (PIPELINE_EMAIL_AREV.md §2). Silencieux."
sudo docker restart hermes-<slug>-pro
# vérifier: cron list (default profile) montre le job
# ⚠️ JAMAIS `-u root` pour les commandes `hermes …` en conteneur : le fichier
# /opt/data/cron/jobs.json deviendrait root-owned et le scheduler casserait
# (incident 10/09 : arev + fateh, 2300+ erreurs IOError). Après tout
# create/remove : `docker exec -u 10000 <c> chown -R 10000:10000 /opt/data/cron`
# (leçon complète : HANDOFF_FATEH.md — leçon cron).
```

## 5. Test bout-en-bout

```bash
# 1. Envoyer un email réel à l'alias dedans (avec PJ facture scannée — PDF)
# → dans les 10 min: le poller cron déclenche run_pipeline.py
# → vérifier la chaîne complète via le audit + le DB:
sudo /home/admin/hermes-fleet/HermesConfig/scripts/audit-hermes-pro.sh <slug>
sudo /home/admin/hermes-fleet/HermesCapabilities/scripts/capability-test.sh all
# vérifier: cap_email_chains, cap_emails, cap_documents (r2_key), cap_factures
#          sums_ok, confiance, facture statut=extracted
```

## 6. Kick et dashboard webapp

- VPN les checks `check-hermesconfig` avant et après le test (les ADR, les skills opencode)
- webapp avec `WEBAPP_DATA_MAPPING.md` pour la présentation (client → mailChain → PJ factures)
- **R2 key** `metadata->>'r2_key'` pour les URLs présignées (webapp)

---

## Ressources pour lesetParameter details

| Ressource | Path |
|---|---|
| Plan global pipeline | `HermesCapabilities/PIPELINE_EMAIL_AREV.md` |
| Webapp data contract | `HermesCapabilities/WEBAPP_DATA_MAPPING.md` |
| Clés (complète) | `HermesCapabilities/DEPLOYMENT.md` |
| Config ADRs | `HermesCapabilities/DECISIONS.md` |
| HermesConfig container deploy | `HermesConfig/DEPLOYMENT.md` |
| Audit complet (opencode) | skill `check-hermesconfig` |

## Coûts estimés par client (mois)

| Service | Coût estimé (par client actif) | Notes |
|---|---|---|
| Gemini (embeddings + ocr vision) | $0.01–$0.05 | 10 mails/jour, 2 PJ |
| OpenRouter GPT-4o-mini | $0.01–$0.02 | cloudflare-ai gratuit pour les PDFs |
| R2 (stockage) | $0.01–$0.02 | quelques Mo/mois par client |
| Supabase | inclus dans le plan existant | multi-tenant, scale up par client |
