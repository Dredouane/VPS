# 🚀 DEPLOYMENT.md — Clés & déploiement des agents à capabilities

> Référence complète des variables d'environnement pour déployer un agent
> à capabilities (pipeline email AREV) — de ton **bashrc local** jusqu'au
> **runtime du conteneur**. Aucune valeur de secret n'est jamais documentée
> ici — uniquement les **noms**.

---

## 1. Les 3 niveaux de variables

| Niveau | Où | Rôle |
|---|---|---|
| **A. Bashrc local** (`~/.bashrc`, préfixe `VPS_`) | Ton PC (WSL) | Source de vérité des secrets — utilisée par les tests locaux et le runner SQL |
| **B. `HermesConfig/clients/<slug>/client.env`** (600, sur le VPS) | VPS | Secrets + config du client — référencé par `env_file` du compose, **jamais commité** |
| **C. Runtime conteneur** | VPS | Les mêmes variables, injectées au process Hermes |

**Flux** : bashrc local → (copie manuelle/ssh) → `client.env` → compose
(`env_file`) → conteneur. Le runner SQL génère automatiquement
`CLIENT_RPC_SECRET` dans `client.env`.

## 2. Table complète des variables

### Réception email (C1 `email-gmail`)

| Var | Niveau B/C | Usage |
|---|---|---|
| `VPS_GMAIL_RECEPTION_IMAP_ADRESS` | ✅ | Boîte Gmail (`REDACTED_EMAIL`) — orthographe historique conservée |
| `VPS_GMAIL_RECEPTION_IMAP_MDP` | ✅ | **App password** IMAP (2FA Gmail requise, IMAP activé) |

> ⚠️ L'OAuth/refresh token n'est **pas** utilisé (D13 — refresh expiré 7j en
> mode Testing). Le helper `gmail-oauth-setup.sh` reste outil plan B.

### Embeddings (C4 `rag-embeddings`)

| Var | Usage |
|---|---|
| `VPS_GEMINI_API_KEY` | Clé Gemini (embeddings `text-embedding-004` 768d + OCR vision #1 + adaptateur SLM Flash) |

### OCR (C3 `doc-ocr`)

| Var | Usage |
|---|---|
| `VPS_GEMINI_API_KEY` | Vision #1 (même clé que C4) |
| `VPS_OPEN_ROUTER_API_KEY` | Vision #2 (OpenRouter, modèle `OCR_OPENROUTER_MODEL=openai/gpt-4o-mini`) |

### RAG / DB (C5 `rag-supabase` + RPC)

| Var | Usage |
|---|---|
| `VPS_SUPERBASE_VPS_DB_URL` | Connection string **admin** (pooler 6543) — runner SQL **uniquement** (jamais au conteneur) |
| `VPS_SUPERBASE_VPS_DB_PROJECT_URL` | URL REST du projet Supabase — conteneur (MCP supabase) |
| `VPS_SUPERBASE_VPS_DB_RPC_KEY` | Clé **publishable** — conteneur (jamais la service key, D8-v3) |

### GED R2 (archivage emails bruts)

| Var | Usage |
|---|---|
| `VPS_GED_CLOUDFLARE_S3_EU_ENDPOINT` | Endpoint R2 (`https://…eu.r2.cloudflarestorage.com`) |
| `VPS_GED_CLOUDFLARE_BUCKET_NAME` | Bucket (ex. `suren-saas-ged`) |
| `VPS_GED_CLOUDFLARE_ACCESS_KEY_ID` | Clé d'accès R2 |
| `VPS_GED_CLOUDFLARE_SECRET_ACCESS_KEY` | Secret R2 (SigV4) |
| `VPS_GED_CLOUDFLARE_TOKEN` | Token API Cloudflare **REST** — ⚠️ **non utilisé** par l'API S3 (R2 rejette x-amz-security-token, vérifié 01/09). Conservé pour l'admin REST |

### Générés automatiquement (ne PAS créer à la main)

| Var | Généré par | Usage |
|---|---|---|
| `CLIENT_RPC_SECRET` | Runner `supabase-sql.sh` (→ `client.env` 600) | Secret RPC du slug — exigé par **toutes** les RPC génériques (D8-v3) |
| `CLIENT_SLUG` | `client.env` (ex. `arev`) | Discriminant multi-tenant — sous-dossier R2, RPC |

### Modèle LLM (Hermes natif)

| Var | Usage |
|---|---|
| `DEEPSEEK_API_KEY` | ⚠️ **Nom natif Hermes** (provider deepseek) — NE PAS renommer en `VPS_*` dans client.env, sinon Hermes ne voit pas la clé. Si tu veux la source préfixée, aliaser dans le spawn (`DEEPSEEK_API_KEY=${VPS_DEEP_SEEK_API_KEY}`) — décision à valider |

## 3. Variables client.env — modèle complet (`clients/arev/client.env`)

```bash
CLIENT_SLUG=arev
CLIENT_NAME="AREV Travaux"

# Telegram
TELEGRAM_BOT_TOKEN=<bot @BotFather dédié>
TELEGRAM_ALLOWED_USERS=<ids équipe>

# Modèle (nom natif Hermes — voir note §2)
DEEPSEEK_API_KEY=<clé deepseek>

# Email C1
VPS_GMAIL_RECEPTION_IMAP_ADRESS=REDACTED_EMAIL
VPS_GMAIL_RECEPTION_IMAP_MDP=<app password>

# Gemini (C3 vision #1 + C4 embeddings + adaptateur Flash)
VPS_GEMINI_API_KEY=<clé gemini valide>

# OpenRouter (C3 vision #2)
VPS_OPEN_ROUTER_API_KEY=<clé openrouter>

# Supabase C5 (REST)
VPS_SUPERBASE_VPS_DB_PROJECT_URL=https://<ref>.supabase.co
VPS_SUPERBASE_VPS_DB_RPC_KEY=<publishable key>

# GED R2 (archivage bruts)
VPS_GED_CLOUDFLARE_S3_EU_ENDPOINT=https://<account>.eu.r2.cloudflarestorage.com
VPS_GED_CLOUDFLARE_BUCKET_NAME=<bucket>
VPS_GED_CLOUDFLARE_ACCESS_KEY_ID=<key id>
VPS_GED_CLOUDFLARE_SECRET_ACCESS_KEY=<secret>
VPS_GED_CLOUDFLARE_TOKEN=<token REST — non utilisé par S3>

# Généré par le runner (ne pas créer à la main)
CLIENT_RPC_SECRET=<généré par supabase-sql.sh>
```

> `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS`, `CLIENT_SLUG`,
> `CLIENT_NAME`, `HERMES_MODEL_*` : inchangés (HermesConfig v2).

## 4. Déploiement du pipeline email (M2.6 — checklist)

```bash
# 0. bashrc local : toutes les VPS_* présentes (tests locaux verts)
# 1. Secrets du client sur le VPS
ssh nemo 'vim /home/admin/hermes-fleet/HermesConfig/clients/arev/client.env'  # §3 + CLIENT_RPC_SECRET
# 2. Sync des sous-projets (miroir git)
rsync -av --exclude 'instances/' --exclude '*.env' \
  ~/dev/VPS/HermesConfig/ ~/dev/VPS/HermesCapabilities/ nemo:/tmp/sync/
ssh nemo 'sudo rsync -a /tmp/sync/HermesConfig/ /home/admin/hermes-fleet/HermesConfig/ \
  && sudo rsync -a /tmp/sync/HermesCapabilities/ /home/admin/hermes-fleet/HermesCapabilities/ \
  && sudo rm -rf /tmp/sync'
# 3. SQL (si nouvelles migrations) — runner génère CLIENT_RPC_SECRET au besoin
ssh nemo 'cd /home/admin/hermes-fleet/HermesCapabilities && sudo ./scripts/supabase-sql.sh arev all --smoke --yes'
# 4. Attach des capabilities (compose re-rendu si spawn v2.1)
ssh nemo 'cd /home/admin/hermes-fleet/HermesCapabilities && sudo ./scripts/capability-attach.sh arev email-gmail email-processing doc-ocr rag-embeddings rag-supabase analysis-facturation ged-r2 --dry-run'
ssh nemo 'cd /home/admin/hermes-fleet/HermesCapabilities && sudo ./scripts/capability-attach.sh arev email-gmail email-processing doc-ocr rag-embeddings rag-supabase analysis-facturation ged-r2'
# 5. Validation
ssh nemo 'cd /home/admin/hermes-fleet/HermesCapabilities && sudo ./scripts/supabase-sql.sh arev status'
ssh nemo 'sudo /home/admin/hermes-fleet/HermesConfig/scripts/audit-hermes-pro.sh arev'
# → envoyer un email réel à REDACTED_EMAIL (avec PJ facture scannée)
# → vérifier : spool, R2 (GED), cap_email_chains/cap_emails, cap_documents, cap_factures (statut extracted)
```

## 5. Coûts / quotas à surveiller par client

| Service | Unité | Estimation AREV (10 mails/j, ~2 PJ) |
|---|---|---|
| Gemini Vision + Flash | requêtes | ~50/jour (2 extracteurs + adapter) |
| Gemini embeddings | tokens | ~10k tokens/jour |
| OpenRouter vision | requêtes | ~10/jour (modèle low-cost) |
| R2 | stockage + ops A/B | quelques Mo/jour |
| Supabase | lignes + pgvector | négligeable au départ |
