# 🔄 SPINOFF_ONBOARDING.md — Deploying a new SME client (end-to-end)

> Onboarding procedure for a **new SME client** on the Hermes factory.
> Involves **2 opencode sessions** (VPS + Pipeline) and **2 subprojects**.
> The pattern is already validated with the client `arev` (01/09/2026).
> After that, a new client = `TEMPLATE` + the 6 steps below.

---

## 0. Credentials — local bashrc (prefix `VPS_*`)

Per-client keys (local bashrc, never committed):

```bash
export VPS_GMAIL_RECEPTION_IMAP_ADRESS="REDACTED_EMAIL"   # shared multi-client mailbox
export VPS_GMAIL_RECEPTION_IMAP_MDP="<app password IMAP>"
export VPS_GEMINI_API_KEY="<valid Google AI Studio key>"
export VPS_OPEN_ROUTER_API_KEY="<OpenRouter key>"
export VPS_SUPERBASE_VPS_DB_URL="REDACTED_DB_URL"
export VPS_SUPERBASE_VPS_DB_PROJECT_URL="https://<ref>.supabase.co"
export VPS_SUPERBASE_VPS_DB_RPC_KEY="<publishable key>"
export VPS_DEEP_SEEK_API_KEY="<deepseek key>"
export VPS_GED_CLOUDFLARE_S3_EU_ENDPOINT="https://<account>.eu.r2.cloudflarestorage.com"
export VPS_GED_CLOUDFLARE_BUCKET_NAME="<bucket>"
export VPS_GED_CLOUDFLARE_ACCESS_KEY_ID="<key id>"
export VPS_GED_CLOUDFLARE_SECRET_ACCESS_KEY="<secret>"
export VPS_GED_CLOUDFLARE_TOKEN="<REST API token — NOT for S3>"
export VPS_TELEGRAM_BOT_TOKEN="<new @BotFather bot for this client>"
```

> Complete reference of the vars: `HermesCapabilities/DEPLOYMENT.md` §3.
> `DEEPSEEK_API_KEY` (native Hermes name) is not renamed.

## 1. Hermes container — `HermesConfig/` (VPS session)

```bash
# 1a. Copy the TEMPLATE and fill in the credentials
cd HermesConfig
cp -r clients/TEMPLATE clients/<slug>
vim clients/<slug>/client.env          # TOKEN_BOT, ALLOWED_USERS, DEEPSEEK, VPS_* keys
cp clients/<slug>/soul.md              # adapt the contract (knows/can/refuses)
chmod 600 clients/<slug>/client.env

# 1b. Deploy the container (idempotent)
sudo ./scripts/spawn-hermes-pro.sh <slug>

# 1c. Create the Telegram bot
# @BotFather → /newbot → client name → get TELEGRAM_BOT_TOKEN (to put in client.env)
```

## 2. SQL migrations + registry — `HermesCapabilities/` (pipeline session)

```bash
# 2a. Sync the 2 subprojects (including HermesCapabilities/i) to the VPS
rsync -av --exclude 'instances/' --exclude '*.env' \
  ~/dev/VPS/HermesConfig/ ~/dev/VPS/HermesCapabilities/ nemo:/tmp/sync/
ssh nemo 'sudo rsync -a /tmp/sync/HermesConfig/ /home/admin/hermes-fleet/HermesConfig/ \
  && sudo rsync -a /tmp/sync/HermesCapabilities/ /home/admin/hermes-fleet/HermesCapabilities/ \
  && sudo rm -rf /tmp/sync'

# 2b. SQL migrations (the runner auto-declares the client in cap_clients)
ssh nemo 'cd /home/admin/hermes-fleet/HermesCapabilities \
  && sudo ./scripts/supabase-sql.sh <slug> all --smoke --yes \
  && sudo ./scripts/supabase-sql.sh <slug> status'
# → expected: N migrations applied, smoke 100 %, client "<slug>" declared
```

> The runner auto-generates `CLIENT_RPC_SECRET` (24 hex) and writes it to
> `HermesConfig/clients/<slug>/client.env` (600). Do not create by hand.

## 3. Attach of capabilities — `HermesCapabilities/` (pipeline session)

```bash
ssh nemo 'cd /home/admin/hermes-fleet/HermesCapabilities \
  && sudo ./scripts/capability-attach.sh <slug> email-gmail email-processing \
      doc-ocr rag-embeddings rag-supabase analysis-facturation ged-r2 --dry-run'
# dry-run: check the secrets, aggregation plan, capabilities.yaml

ssh nemo 'cd /home/admin/hermes-fleet/HermesCapabilities \
  && sudo ./scripts/capability-attach.sh <slug> email-gmail email-processing \
      doc-ocr rag-embeddings rag-supabase analysis-facturation ged-r2'
# → skills mounted in data/skills/, code in data/code/, soul merged,
#   r2_key metadata ready, capabilities.yaml state updated
```

## 4. Email-poll routine (Hermes cron, run by the default profile scheduler)

```bash
sudo docker exec -u 10000 hermes-<slug>-pro /opt/hermes/.venv/bin/hermes cron create \
  "*/10 8-19 * * *" \
  "Run the email pipeline: python3 /opt/data/code/email-processing/run_pipeline.py \
   --max-threads 5 (PIPELINE_EMAIL_AREV.md §2). Silent."
sudo docker restart hermes-<slug>-pro
# check: cron list (default profile) shows the job
# ⚠️ NEVER `-u root` for `hermes …` commands in the container: the file
# /opt/data/cron/jobs.json would become root-owned and the scheduler would break
# (incident 10/09: arev + fateh, 2300+ IOError errors). After any
# create/remove: `docker exec -u 10000 <c> chown -R 10000:10000 /opt/data/cron`
# (full lesson: HANDOFF_FATEH.md — cron lesson).
```

## 5. End-to-end test

```bash
# 1. Send a real email to the alias (with a scanned invoice attachment — PDF)
# → within 10 min: the cron poller triggers run_pipeline.py
# → check the full chain via the audit + the DB:
sudo /home/admin/hermes-fleet/HermesConfig/scripts/audit-hermes-pro.sh <slug>
sudo /home/admin/hermes-fleet/HermesCapabilities/scripts/capability-test.sh all
# check: cap_email_chains, cap_emails, cap_documents (r2_key), cap_factures
#        sums_ok, confidence, invoice status=extracted
```

## 6. Kick and webapp dashboard

- VPN the `check-hermesconfig` checks before and after the test (the ADRs, the opencode skills)
- webapp with `WEBAPP_DATA_MAPPING.md` for the presentation (client → mailChain → invoice attachments)
- **R2 key** `metadata->>'r2_key'` for the presigned URLs (webapp)

---

## Resources for theParameter details

| Resource | Path |
|---|---|
| Overall pipeline plan | `HermesCapabilities/PIPELINE_EMAIL_AREV.md` |
| Webapp data contract | `HermesCapabilities/WEBAPP_DATA_MAPPING.md` |
| Keys (complete) | `HermesCapabilities/DEPLOYMENT.md` |
| Config ADRs | `HermesCapabilities/DECISIONS.md` |
| HermesConfig container deploy | `HermesConfig/DEPLOYMENT.md` |
| Complete audit (opencode) | skill `check-hermesconfig` |

## Estimated costs per client (month)

| Service | Estimated cost (per active client) | Notes |
|---|---|---|
| Gemini (embeddings + ocr vision) | $0.01–$0.05 | 10 emails/day, 2 attachments |
| OpenRouter GPT-4o-mini | $0.01–$0.02 | cloudflare-ai free for PDFs |
| R2 (storage) | $0.01–$0.02 | a few MB/month per client |
| Supabase | included in the existing plan | multi-tenant, scales up per client |
