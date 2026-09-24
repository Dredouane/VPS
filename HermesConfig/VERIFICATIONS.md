# 🔍 VERIFICATIONS.md — HermesConfig invariants register

> Source of truth for the non-regression invariants of the VPS project.
> Referenced by the opencode skill `check-hermesconfig`
> (`.opencode/skills/check-hermesconfig/SKILL.md`).
> **Rule**: any new lesson → update this file + the skill
> (+ `audit-hermes-pro.sh` if VPS-side), committed together.

## §1 Invariants — session 30/08/2026 (HermesConfig v2)

| ID | Invariant | Decision | Lesson / date |
|---|---|---|---|
| I1 | No env line `TELEGRAM_FALLBACK_IPS=` (raw IP TLS → certificate failure); the template's prohibition comment is expected | — | 30/08: Telegram timeout on arev deployment, resolved by removing the var |
| I2 | Ports `127.0.0.1:` only | D4 | — |
| I3 | Pinned image, never `latest` | D8 | — |
| I4 | Secrets via `env_file: instances/<slug>/secrets.env` (600) — never inline, never client.env directly | D3 | 30/08: DEEPSEEK key inherited from /etc/secrets/ not passed via direct client.env |
| I5 | `cap_drop: ALL` + `no-new-privileges:true` + minimal caps | D5 | — |
| I6 | `HERMES_UID/GID=10000`, data-dir `10000:10000 700` | D5 | 30/08: image UID verified (useradd -u 10000, entrypoint gosu) |
| I7 | Vault mount scoped per client, never the Obsidian root | D6 | — |
| I8 | Health via `gateway_state.json` (`"state":"connected"`) — never curl /health | — | 30/08: 8642 API inactive in headless gateway (empty listen verified) |
| I9 | `security.redact_secrets: true` + `HERMES_DASHBOARD=0` | D12 | — |
| I10 | `mem_limit` + `cpus` + logs 10m×3 + `restart: unless-stopped` | D10 | — |
| I11 | Spawn: sourcing `/etc/secrets/hermes.env` (fallback), DEEPSEEK inheritance, `umask 077` + secrets.env 600, secrets never CLI/YAML | — | 30/08: non-interactive SSH did not source /root/.bashrc |
| I12 | Spawn idempotent (port kept, compose re-rendered, data kept) | — | 30/08: port shifted 8654→8655 on re-spawn before fix |
| I13 | Vault client dir `10000:10000` + 775 + ACL `u:syncthing:rwx` (+default); `acl` package installed | D6 | 30/08: setfacl missing → degraded Syncthing sync |
| I14 | `HermesConfig/` on VPS = mirror of the git repo (change → repo + rsync) | — | Convention 30/08 |
| I15 | `SOUL.md` mandatory: knows / can / refuses / escalates | Lesson @QuentinLecocq_ | — |

## §2 Check catalogue (command details: see the SKILL.md)

| Part | Scope | When to run |
|---|---|---|
| A. Local | git secrets, .gitignore, structure (17 files), template invariants I1-I10, example config, scripts (syntax + anchors I11-I12), placeholders, soul.md contracts | Before any HermesConfig commit; after any local change |
| B. VPS | audit-hermes-pro.sh (0 FAIL), real I1/I4, instance health, secrets 600 + non-empty vars, data-dirs, vault ACL + notes, **repo↔VPS md5 drift (I14)**, arev native transition | After VPS deployment/change; periodically |
| C. Consistency | root README, DOCUMENTATION_VPS §4.5bis, VERIFICATIONS.md, git state | New session / before commit |
| D. Observation | hardening, monitoring, fleet v1 (other sessions) — informational WARN | New session |

## §3 Scope of other sessions (reference — D checks, non-blocking)

- **Hardening**: SSH $VPS_SSH_PORT key-only (root blocked), fail2ban sshd jail,
  UFW deny incoming + deny 8642/8650-8653 + 22000 restricted, AIDE (cron 3h,
  base regenerated 30/08 21:34), unattended-upgrades, secrets in
  `/etc/secrets/hermes.env` (600, dir 700).
- **Monitoring (§5.5 audit)**: `/usr/local/bin/telegram-alert.sh` +
  PAM hook sshd (alert only unusual logins — allowlist
  `SSH_ALERT_ALLOWED_IPS`) + conditional `aide-check-alert.sh`.
- **Fleet v1 (legacy)**: `hermes-leanConstruction` (8650),
  `hermes-copycat` (8651), `hermes-aquisition` (8652), `hermes-va_agent`
  (8653); native `hermes-gateway-hermesrunner` (@pipou200bot),
  `hermes-gateway-arev` (@Arev_Chantiers_AssistBot). Managed by
  `spawn-hermes.sh` — **do not add new clients in v1**.

## §4 History

- **2026-08-30**: register creation (I1-I15) — lessons from the
  HermesConfig v2 session: `TELEGRAM_FALLBACK_IPS` (raw IP TLS), headless
  8642 API inactive (healthcheck → state file), vault ACL (acl package),
  secrets.env resolution (fallback /etc/secrets), repo↔VPS drift (mirror),
  spawn idempotence (port kept).
