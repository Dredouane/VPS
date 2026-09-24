---
name: check-hermesconfig
description: >-
  Non-regression check of the VPS project and the HermesConfig + HermesCapabilities
  sub-projects (pro Hermes agents for SME clients). Use when the user says
  "check", "vérification", "non-régression", "audit projet", "check
  HermesConfig", "audit-hermes-pro", at the start of a session on this repo,
  before any commit touching HermesConfig/ or HermesCapabilities/, or after
  any VPS deployment. Local git/template invariants + read-only SSH fleet
  checks + capability contract tests.
---

# HermesConfig non-regression check

Run the exact commands below from the repo root
(`/home/redouane/dev/VPS`). Absolute rules:

1. NEVER auto-fix a FAIL — report and propose.
2. NEVER display a secret value (count non-empty values with `grep -c`,
   check presence with `test -n`).
3. Reference register: `HermesConfig/VERIFICATIONS.md` (invariants I1-I15,
   dated lessons). Consult it if a check fails to understand the why.
4. SSH unavailable (`ssh -o BatchMode=yes -o ConnectTimeout=8 nemo 'echo ok'`
   fails) → section B = `⏭ SKIP` (never blocking). Sections A and C still
   run.
5. Output: table `| Check | PASS / FAIL / WARN / SKIP | Detail |` then
   corrective actions **proposed** (no execution without user
   validation). Global verdict: SAIN / ACTION REQUISE.

## A. Local (always)

A1. Secrets in versioned files (expected: empty):

    git ls-files | xargs grep -lEn '(sk-[A-Za-z0-9]{10,}|[0-9]{6,12}:AA[A-Za-z0-9_-]{30,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,})'

A2. Sensitive files versioned (expected: empty):

    git ls-files | grep -E '\.(env|key|pem)$|\.tar\.gz$|Zone\.Identifier'

A3. `.gitignore` covers `*.env`: `grep -q '^\*\.env$' .gitignore`

A4. Required files present (`test -f`, 17 files):
    `HermesConfig/README.md`, `HermesConfig/VEILLE_HERMES_2026-08.md`,
    `HermesConfig/ARCHITECTURE.md`, `HermesConfig/DEPLOYMENT.md`,
    `HermesConfig/docker/docker-compose.yml.template`,
    `HermesConfig/hermes/config.yaml.example`,
    `HermesConfig/hermes/bots/README.md`,
    `HermesConfig/hermes/bots/ops-bot.example.md`,
    `HermesConfig/hermes/routines/README.md`,
    `HermesConfig/hermes/skills/README.md`,
    `HermesConfig/clients/TEMPLATE/client.env.example`,
    `HermesConfig/clients/TEMPLATE/soul.md`,
    `HermesConfig/clients/arev/client.env.example`,
    `HermesConfig/clients/arev/soul.md`,
    `HermesConfig/scripts/spawn-hermes-pro.sh`,
    `HermesConfig/scripts/audit-hermes-pro.sh`,
    `HermesConfig/VERIFICATIONS.md`

A5. Template invariants (`T=HermesConfig/docker/docker-compose.yml.template`):

    I1  : grep -E '^\s*-\s*TELEGRAM_FALLBACK_IPS=' "$T"   → expected EMPTY
          (the prohibition comment around line ~30 is legitimate)
    I2  : grep -q '127\.0\.0\.1:__PORT__' "$T"
    I3  : grep -q '__IMAGE__' "$T" ; grep -c 'latest' "$T" → 0
    I4  : grep -q 'secrets\.env' "$T" ; and NO line
          'TELEGRAM_BOT_TOKEN=' or '_API_KEY=' in the environment: section
    I5  : grep -q 'cap_drop' "$T" ; grep -q 'no-new-privileges:true' "$T"
    I6  : grep -q 'HERMES_UID=10000' "$T"
    I7  : grep -q '__VAULT_CLIENT_DIR__:/opt/vault' "$T"
    I8  : grep -q 'gateway_state\.json' "$T" ;
          grep -c '/dev/tcp/127\.0\.0\.1/8642' "$T" → 0
    I10 : grep -q 'mem_limit' "$T" ; grep -q 'cpus' "$T"

A6. `HermesConfig/hermes/config.yaml.example`: `grep -q 'redact_secrets: true'`

A7. Scripts (`S=HermesConfig/scripts/spawn-hermes-pro.sh`):
    - `bash -n HermesConfig/scripts/spawn-hermes-pro.sh` and
      `bash -n HermesConfig/scripts/audit-hermes-pro.sh`
    - `test -x` on both
    - Anchors in $S (grep -q, each must pass): 'umask 077',
      '/etc/secrets/hermes.env', 'Port existant conservé',
      'docker exec "hermes-$SLUG-pro" grep -qs', 'INHERITED_DEEPSEEK_KEY'
    - Anti-leak guard present in both scripts:
      grep -q 'sk-\[A-Za-z0-9\]' <script>

A8. `HermesConfig/clients/*/client.env.example`:
    `grep -E 'TELEGRAM_BOT_TOKEN=.'` → empty (empty token);
    no real token (pattern `[0-9]{6,12}:AA`)

A9. `HermesConfig/clients/*/soul.md`: contains knows / can / refuses / escalates

A10. HermesCapabilities sub-project (part 2 — modular competencies):

     Required files (`test -f`):
     `HermesCapabilities/README.md`, `HermesCapabilities/ARCHITECTURE.md`,
     `HermesCapabilities/DECISIONS.md`,
     `HermesCapabilities/PIPELINE_EMAIL_AREV.md`,
     `HermesCapabilities/integration-hermesconfig.md`,
     `HermesCapabilities/pipelines/TEMPLATE/pipeline.yaml`,
     `HermesCapabilities/sql/README.md`,
     `HermesCapabilities/sql/generic/001_schema.sql`,
     `HermesCapabilities/sql/generic/002_clients.sql`,
     `HermesCapabilities/sql/generic/008_backfill_document_id.sql`,
     `HermesCapabilities/sql/arev/001_rpc.sql`,
     `HermesCapabilities/scripts/supabase-sql.sh`,
     `HermesCapabilities/capabilities/TEMPLATE/manifest.yaml`,
     `HermesCapabilities/capabilities/TEMPLATE/decision.md`,
     `HermesCapabilities/capabilities/TEMPLATE/soul-addendum.md`,
     `HermesCapabilities/capabilities/TEMPLATE/tests/test.sh`,
     `HermesCapabilities/capabilities/email-gmail/manifest.yaml`,
     `HermesCapabilities/capabilities/email-gmail/decision.md`,
     `HermesCapabilities/capabilities/email-gmail/soul-addendum.md`,
     `HermesCapabilities/capabilities/email-gmail/skill.md`,
     `HermesCapabilities/capabilities/email-gmail/routine.yaml`,
     `HermesCapabilities/capabilities/email-gmail/code/imap_poll.py`,
     `HermesCapabilities/capabilities/email-gmail/code/imap_mark_done.py`,
     `HermesCapabilities/capabilities/email-gmail/tests/test.sh`,
     `HermesCapabilities/capabilities/email-processing/manifest.yaml`,
     `HermesCapabilities/capabilities/email-processing/code/thread_parser.py`,
     `HermesCapabilities/capabilities/email-processing/code/thread_parser.py`,
     `HermesCapabilities/capabilities/email-processing/code/clean_body.py`,
     `HermesCapabilities/capabilities/email-processing/tests/test.sh`,
     `HermesCapabilities/capabilities/doc-ocr/manifest.yaml`,
     `HermesCapabilities/capabilities/doc-ocr/decision.md`,
     `HermesCapabilities/capabilities/doc-ocr/soul-addendum.md`,
     `HermesCapabilities/capabilities/doc-ocr/skill.md`,
     `HermesCapabilities/capabilities/doc-ocr/code/ocr_gemini.py`,
     `HermesCapabilities/capabilities/doc-ocr/code/ocr_openrouter.py`,
     `HermesCapabilities/capabilities/doc-ocr/code/ocr_judge.py`,
     `HermesCapabilities/capabilities/doc-ocr/code/invoice_adapter.py`,
     `HermesCapabilities/capabilities/doc-ocr/code/invoice_check.py`,
     `HermesCapabilities/capabilities/doc-ocr/code/doc_extract.py`,
     `HermesCapabilities/capabilities/doc-ocr/schemas/invoice_extraction.json`,
     `HermesCapabilities/capabilities/doc-ocr/tests/test.sh`,
     `HermesCapabilities/capabilities/ged-r2/manifest.yaml`,
     `HermesCapabilities/capabilities/ged-r2/code/r2_client.py`,
     `HermesCapabilities/capabilities/ged-r2/code/ged_save.py`,
     `HermesCapabilities/capabilities/ged-r2/tests/test.sh`,
     `HermesCapabilities/capabilities/rag-embeddings/manifest.yaml`,
     `HermesCapabilities/capabilities/rag-embeddings/code/embed_gemini.py`,
     `HermesCapabilities/capabilities/rag-embeddings/tests/test.sh`,
     `HermesCapabilities/capabilities/analysis-facturation/manifest.yaml`,
     `HermesCapabilities/capabilities/analysis-facturation/skills/expert-router.md`,
     `HermesCapabilities/capabilities/analysis-facturation/skills/expert-facturation.md`,
     `HermesCapabilities/capabilities/analysis-facturation/tests/test.sh`,
     `HermesCapabilities/DEPLOYMENT.md`,
     `HermesCapabilities/WEBAPP_DATA_MAPPING.md`,
     `HermesCapabilities/requirements.txt`,
     `HermesCapabilities/capabilities/email-processing/code/vendor/mailparser_reply/parser.py`,
     `HermesCapabilities/capabilities/email-gmail/tests/fixtures/rfc822_sample_plain.eml`,
     `HermesCapabilities/scripts/gmail-oauth-setup.sh`,
     `HermesCapabilities/capabilities/rag-supabase/manifest.yaml`,
     `HermesCapabilities/capabilities/rag-supabase/decision.md`,
     `HermesCapabilities/capabilities/rag-supabase/soul-addendum.md`,
     `HermesCapabilities/capabilities/rag-supabase/skill.md`,
     `HermesCapabilities/capabilities/rag-supabase/mcp.json`,
     `HermesCapabilities/capabilities/rag-supabase/tests/test.sh`

     Contract tests (expected: 0 FAIL, all PASS):

     HermesCapabilities/scripts/capability-test.sh all

     Scripts: `bash -n` + `test -x` on `capability-test.sh` and
     `capability-attach.sh`. The `decision.md` of each capability contains a
     native/mix/sidecar verdict (covered by the contract tests).

## B. VPS (read-only — SKIP if SSH unavailable)

Prefix: `ssh -o BatchMode=yes -o ConnectTimeout=8 nemo`

B1. Fleet audit (expected: 0 FAIL):

    ssh -o BatchMode=yes nemo 'cd /home/admin/hermes-fleet/HermesConfig && sudo ./scripts/audit-hermes-pro.sh'

B2. Invariants I1/I4 in real conditions:

    ssh -o BatchMode=yes nemo 'sudo grep -lE "^\s*-\s*TELEGRAM_FALLBACK_IPS=" /home/admin/hermes-fleet/HermesConfig/instances/*/docker-compose.yml'
    → expected empty; and each compose references secrets.env

B3. Per instance (`instances/*/`): container `running`, healthcheck `healthy`,
    `gateway_state.json` contains `"state":"connected"`, port bound to `127.0.0.1`,
    image non-`latest`, `RestartPolicy=unless-stopped`, LogConfig max-size
    `10m`, Memory > 0; and the image tag exists locally
    (`docker images` contains the exact tag used).
    (B1 covers the essentials — only redo the details in case of doubt.)

B4. Secrets: `instances/*/secrets.env` and `clients/*/client.env` at 600;
    `TELEGRAM_ALLOWED_USERS` and `DEEPSEEK_API_KEY` non-empty — check by
    counting (`grep -c 'VAR=.'`), NEVER by displaying the values.

B5. `instances/*/data`: `config.yaml` contains `redact_secrets: true`,
    `SOUL.md` present, data-dir at `10000:10000` / `700`.

B6. Vault: `sudo getfacl /home/syncthing/obsidian-vault/VPS/HermesConfig/<slug>`
    → `user:syncthing:rwx` + `default:user:syncthing:rwx`; the 4 notes
    present in `/home/syncthing/obsidian-vault/VPS/HermesConfig/`
    (VEILLE, Décisions, Runbook AREV, État flotte pro); `arev/` sub-folder.
    ⚠️ List with `sudo ls` (directory owned by syncthing — a plain `ls`
    as admin fails with Permission denied).

B7. Repo↔VPS drift (I14): compare local vs VPS md5sums on
    `scripts/spawn-hermes-pro.sh`, `scripts/audit-hermes-pro.sh`,
    `docker/docker-compose.yml.template`, `VERIFICATIONS.md`:

    md5sum HermesConfig/scripts/*.sh HermesConfig/docker/docker-compose.yml.template HermesConfig/VERIFICATIONS.md
    ssh -o BatchMode=yes nemo 'sudo md5sum /home/admin/hermes-fleet/HermesConfig/scripts/*.sh /home/admin/hermes-fleet/HermesConfig/docker/docker-compose.yml.template /home/admin/hermes-fleet/HermesConfig/VERIFICATIONS.md'

    → the hashes must be IDENTICAL. Any gap = direct edit on the
    VPS not carried back into git (or rsync forgotten) → FAIL + propose a resync.

B8. Transition: `ssh nemo 'systemctl is-active hermes-gateway-arev'` = active
    OR cutover documented in the vault note "État flotte pro.md".

## C. Consistency (local)

- Root `README.md` mentions `HermesConfig` **and** `HermesCapabilities` (grep)
- `Installation/DOCUMENTATION_VPS.md` contains `4.5bis` (grep)
- `HermesConfig/VERIFICATIONS.md` exists
- `HermesConfig/README.md` references part 2 `HermesCapabilities` (grep)
- `git status -sb`: clean tree (or owned changes); note the
  number of commits ahead of `origin/main`

## D. Observation — other sessions (informational WARN, NEVER FAIL)

`ssh nemo` (read-only): `sudo ufw status` contains deny 8642 and 8650-8653 +
allow $VPS_SSH_PORT; `sudo fail2ban-client status sshd` active; `grep pam_exec
/etc/pam.d/sshd` present; fleet v1 visible (`docker ps`: 4 non `-pro`
hermes-* containers, 2 active native runners).
These items belong to other sessions — any anomaly = WARN.

## Mandatory output

Table: `| Check | PASS / FAIL / SKIP | Detail |` then corrective actions
proposed (no execution without user validation). Unavailable VPS
sections = SKIP. Conclude with a global verdict: SAIN / ACTION REQUISE.

## Remediation (on FAIL)

Always start from the `HermesConfig/VERIFICATIONS.md` register (invariants
I1-I15 + dated lessons); VPS side: `HermesConfig/DEPLOYMENT.md`;
general complements: `Installation/DOCUMENTATION_VPS.md` §4.5bis.

## Extending (as the project advances)

- New client → NOTHING to do: B1/B3 iterate over `instances/*/`.
- New HermesCapabilities capability → update the A10 list
  (new required files); the runner `capability-test.sh all` automatically
  covers the contracts.
- New invariant (new lesson) → 1) this SKILL.md, 2)
  `HermesConfig/VERIFICATIONS.md` (+ date and lesson), 3) `audit-hermes-pro.sh`
  if VPS-side. Commit all three together.
- AREV cutover (stopping the native runner) → update B8 here and the
  "État flotte pro.md" note.
