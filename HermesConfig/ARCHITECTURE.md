# 🏗️ HermesConfig Architecture — Decisions (ADR)

Statuses: ✅ accepted · 🔄 revisable. Date: 30/08/2026. Context: Contabo VPS
`$VPS_HOSTNAME` (hardened Ubuntu 22.04 — UFW, Fail2ban, AIDE, secrets in
`/etc/secrets/`), existing Hermes fleet (4 Docker + 2 native).

---

## D1 — Deployment mode: Docker fleet v2 ✅

**Decision**: one container per client agent, orchestrated by
`spawn-hermes-pro.sh`, from `docker/docker-compose.yml.template`.

**Rationale**:
- Consistency with the existing fleet (`/home/admin/hermes-fleet/`).
- Strong isolation (critical after the historical rootkit incident).
- Reproducibility and clear version pinning.
- Volumes (SQLite, `.hermes`, vault) perfectly manageable without userns-remap.

**Documented alternative (native systemd mode)**: like `arev-chantier-runner`
— dedicated user without sudo, service `hermes-gateway-<slug>.service`
(`Restart=always`, `enabled`), binary `/usr/local/bin/hermes`, `~/.hermes/`
as home. Reserved for cases where Docker is not desirable; the sub-project
and the spawn script are **Docker-first**.

## D2 — Variabilized client ✅

**Decision**: the client is a **slug** (`arev`, `monclient`…). Everything
derives from `clients/<slug>/`: `client.env` (secrets + config), `soul.md`
(contract). A new client = `cp -r clients/TEMPLATE clients/<slug>` + fill in
the variables + `spawn-hermes-pro.sh <slug>`. **No code changes.**

## D3 — Secrets: never in YAML, CLI or git ✅

- `clients/<slug>/client.env` (mode 600) referenced by `env_file:` in the
  generated compose — secrets **never** appear in plain text in the YAML.
- Global keys (DeepSeek…): `/etc/secrets/hermes.env` on the host side if needed.
- The repo `.gitignore` covers `*.env`. The `.env.example` files contain
  empty placeholders only.
- `security.redact_secrets: true` enabled in the runtime config.

## D4 — Network: loopback only ✅

`ports: - "127.0.0.1:<port>:8642"` — the gateway API is reachable only from
the host (SSH tunnel). UFW `deny 864x` stays as defense in depth. No public
exposure, unlike fleet v1 (`0.0.0.0` + UFW only).

## D5 — Container runtime: official gosu flow, minimal caps ✅

Verified in the image (`hermes-repo` Dockerfile + `docker/entrypoint.sh`):
- The image user `hermes` = **UID 10000** (`useradd -u 10000`).
- The entrypoint, launched as root: optional remap `HERMES_UID`/`HERMES_GID`,
  fix ownership of the data-dir + `.venv`, `config.yaml` at 640, then
  **gosu → hermes**. The gateway process **never** runs as root after the drop.

**Choice**: do NOT force `user:` in the compose (it would break the
entrypoint/`.venv` logic); instead:
- explicit `HERMES_UID=10000`, `HERMES_GID=10000`,
- data-dir pre-created by the spawn: `chown 10000:10000`, `chmod 700`,
- `security_opt: [no-new-privileges:true]` (gosu = privilege drop, compatible),
- `cap_drop: [ALL]` + `cap_add: [CHOWN, FOWNER, SETUID, SETGID, DAC_OVERRIDE]`
  (the minimum required by usermod/chown/gosu in the entrypoint's root phase),
- `read_only: false` (Hermes writes caches/sessions to `HERMES_HOME` and
  `/opt/hermes/.venv` — no `read_only: true` without thorough qualification).

## D6 — Obsidian vault: mounts scoped per client ✅

- ❌ Never mount the whole `/home/syncthing/obsidian-vault` (cross-leak
  between clients).
- ✅ Single mount: `/home/syncthing/obsidian-vault/VPS/HermesConfig/<slug>/`
  → `/opt/vault` (rw restricted to the client scope).
- Permissions: directory owned by `10000:10000` (the agent), ACL
  `u:syncthing:rwx` (default included) to preserve Syncthing sync.
  `chown` fallback if `setfacl` is unavailable.
- `HERMES_VAULT_DIR=/opt/vault` on the container side.

## D7 — Bot Mode: measured, server roles ✅

- 2-4 stable roles **max** per client (see `hermes/bots/README.md`).
- Bot vs Subagent rule (veille §3.1): recurring + own memory + own
  capabilities + callable by role → **Bot**; otherwise temporary subagent.
- Ops Bot (with cron routines) first; Desktop needed for group
  chats, but profiles/routines work headless Docker.

## D8 — Pinned image ✅

- Explicit tag (`hermes-agent:vYYYY.M.D-<rev>`), **never `latest`** in the
  generated composes.
- The spawn script checks the presence of the tagged image (creates it from
  `hermes-repo` if absent, or retags the image built that day after human
  validation).
- Update procedure: `git -C hermes-repo pull` → build → **test on a
  non-critical agent** → retag → redeploy.

## D9 — Telegram token: option A (new bot per agent) ✅

- New @BotFather bot for each pro agent → zero 409 polling conflict,
  smooth migration, the existing native runner (`arev-chantier-runner`,
  @Arev_Chantiers_AssistBot) can stay in parallel during tests.
- Option B (reusing the existing token) requires stopping the native runner
  **before** the spawn — documented in DEPLOYMENT.md as the cutover path.

## D10 — Observability & robustness ✅

- compose `healthcheck`: `gateway_state.json` (`"state":"connected"`) —
  source of truth (the 8642 API does not run in headless gateway),
  `start_period` 90 s (first boot = config bootstrap + Telegram login).
- ⚠️ **Lesson (30/08/2026)**: do not define `TELEGRAM_FALLBACK_IPS` — direct
  TLS to the raw IP fails certificate verification on recent builds →
  "connect timed out". Direct connection to `api.telegram.org`: OK.
- `restart: unless-stopped`, capped Docker logs (`10m`, 3 files).
- `mem_limit` / `cpus` per container (multi-tenant: one runaway agent cannot
  starve the VPS).
- `audit-hermes-pro.sh`: read-only audit (health, ports, perms, secret
  leaks, Telegram state, resources).
- Backups: `/home/admin/hermes-fleet/HermesConfig/instances/<slug>/data/`
  + `clients/` to be integrated into the VPS backup procedure (see
  `DOCUMENTATION_VPS.md` §6).

## D11 — Cron routines attached to the Ops bot ✅

Recurring responsibilities (backup check, monitoring, reports) live on the
client's **Ops bot**, not on the main agent. Tool: `hermes cron`
(headless). See `hermes/routines/README.md`.

## D12 — Pro runtime config ✅

`hermes/config.yaml.example` (copied into the data-dir at spawn):
- `security.redact_secrets: true`,
- explicit model/provider (DeepSeek by default, overridden by `client.env`),
- dashboard disabled (`HERMES_DASHBOARD=0`),
- approvals: interactive mode kept — no `--yolo`, no `--safe-mode` bypass;
  see `hermes/bots/README.md`.
