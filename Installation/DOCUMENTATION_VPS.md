# Global Documentation — Contabo VPS (Ubuntu 22.04 LTS)

**Hostname**: `$VPS_HOSTNAME`
**Public IP**: `$VPS_IP`
**Context**: VPS re-imagined at Contabo then reinstalled + hardened (started from scratch), data restored from `backup.tar.gz`, then repair of the Hermes agent fleet.

---

## 1. SSH Access

### Aliases configured in `~/.ssh/config` (local WSL machine)

```
Host nemo-root   # temporary root connection (PORT 22, password) — NO LONGER AVAILABLE (root blocked)
Host nemo        # admin connection (PORT $VPS_SSH_PORT, ed25519 key)   → USE THIS ONE
```

| Parameter | Value |
|---|---|
| Admin user | `admin` |
| SSH port | **$VPS_SSH_PORT** |
| Authentication | SSH key only (`id_ed25519` + `$VPS_SSH_KEY`) |
| `PermitRootLogin` | `no` (root impossible via SSH) |
| `PasswordAuthentication` | `no` |

Commands:
```bash
ssh nemo            # admin connection (port $VPS_SSH_PORT)
# In case of SSH lockout: Contabo web console (VNC) as root, root password.
```

---

## 2. Users

| User | Role | Sudo | Docker |
|---|---|---|---|
| `admin` | Administrator | ✅ NOPASSWD | ✅ |
| `hermes` | Service (created by the plan, unused) | ❌ | ❌ |
| `syncthing` | System (sync service) | ❌ | ❌ |
| `hermesrunner` | Native Hermes runner (bot @pipou200bot) | ❌ | ❌ |
| `loukyrunner` | Native runner (DUPLICATE of hermesrunner — same token) | ❌ | ❌ |
| `arev-chantier-runner` | Native Hermes runner (bot @Arev_Chantiers_AssistBot) | ❌ | ❌ |

**Note**: `loukyrunner` and `hermesrunner` share the SAME Telegram token (@pipou200bot) and the same DeepSeek key. Only one of the two can run at a time (polling conflict). `hermesrunner` is active.

**Audit 30/08/2026**: the cloud-init `ubuntu` user (uid 1000, bash shell, `authorized_keys` present + `NOPASSWD:ALL` in `sudoers.d/90-cloud-init-users` — an **undocumented** second root-equivalent door) was **deleted** along with its sudoers rule. Only `admin` remains root-equivalent.

---

## 3. Security / Applied Hardening

| Component | Status |
|---|---|
| Hardened SSH | Port $VPS_SSH_PORT, key only, root blocked, modern ciphers/MACs |
| Fail2ban | `sshd` jail on port $VPS_SSH_PORT, banaction ufw, bantime 24h |
| UFW | `deny incoming`, `allow $VPS_SSH_PORT`, DOCKER-USER rules, `deny 8642` |
| Docker | `no-new-privileges`, **no** userns-remap, logs 10m×3 |
| AIDE | Integrity database (sha256), daily cron at 3am |
| Unattended-upgrades | Active (automatic security patches) |
| Sysctl | kptr_restrict=2, dmesg_restrict=1, perf_paranoid=3, etc. |
| Postfix | Restricted to localhost (loopback-only) |
| Secrets | `/etc/secrets/hermes.env` (600, dir 700) sourced by `/root/.bashrc` (600) — migrated on 30/08 |
| cloud-init user `ubuntu` | Deleted (R1 audit 30/08) — sudoers `90-cloud-init-users` removed |
| AIDE cron | Dynamic dated log `aide-$(date +\%Y\%m\%d).log` (fixed on 30/08) |
| snapd | Disabled |
| Telegram monitoring | `/usr/local/bin/telegram-alert.sh` (credentials in `/etc/secrets/hermes.env`) — PAM hook for sshd: alert **only on unusual login** (IP ≠ allowlist `SSH_ALERT_ALLOWED_IPS=$SOURCE_IP`, user ≠ admin, or local login) + conditional AIDE alert (cron 3am) — 30/08 |
| AIDE (churn exclusions) | `99_custom`: agent data-dirs, `.hermes` of the 3 users, Syncthing index, fail2ban.sqlite3, landscape, Obsidian vault, `/run/containerd` — database regenerated on 30/08 21:34, check 0 diff |

### Publicly listening ports

| Port | Service | Note |
|---|---|---|
| $VPS_SSH_PORT/tcp | SSH | Allowed by UFW |
| 8642/tcp | hermesrunner native API gateway | **UFW DENY** (protected by API_SERVER_KEY) |
| 8650-8653/tcp | Docker agents (container API gateways 8642) | **UFW DENY** (published ports but publicly blocked) |
| 22000/tcp | Syncthing (data sync) | **CLOSED (01/09)** — sync will go through Tailscale (enrolled server: $TAILSCALE_IP) |

### ✅ Secrets migrated to `/etc/secrets/` (30/08/2026 — audit)

The secrets formerly in plaintext in `/root/.bashrc` (DeepSeek/Gemini/OpenRouter API keys, Telegram bot tokens, Google Cloud credentials, SUREN test credentials) were **migrated** to `/etc/secrets/hermes.env` (600, dir 700, root only). `/root/.bashrc` (600) ends with:
```bash
[ -f /etc/secrets/hermes.env ] && . /etc/secrets/hermes.env
```
Scripts run **in an interactive root shell** (e.g. `spawn-hermes.sh`) therefore automatically load the secrets. Pre-migration backup: `/root/.bashrc.preaudit-20260830`. Rules: never commit this file, always `chmod 600`.

---

## 4. Hermes Agent Fleet

### 4.1 Architecture

Two deployment modes:
- **Dockerized agents**: one container per agent, image `hermes-agent:latest`, orchestrated by `/home/admin/hermes-fleet/spawn-hermes.sh`
- **Native agents**: system-wide Hermes installation (`/usr/local/lib/hermes-agent`, binary `/usr/local/bin/hermes`), one systemd service per runner

### 4.2 Hermes Installation

| Item | Location |
|---|---|
| System binary | `/usr/local/bin/hermes` (v0.20.6) |
| System code/venv | `/usr/local/lib/hermes-agent/` (Python 3.11 venv) |
| Docker build repo | `/home/admin/hermes-fleet/hermes-repo/` |
| Docker image | `hermes-agent:latest` (5.22 GB, v0.14.0) |
| Fleet script | `/home/admin/hermes-fleet/spawn-hermes.sh` |

### 4.3 DEPLOYED and FUNCTIONAL Agents

| Agent | Mode | Container/Service | Port | Telegram Bot | Status |
|---|---|---|---|---|---|
| **leanConstruction** | Docker | `hermes-leanConstruction` | 8650 | @lean_construction_bot | ✅ connected |
| **copycat** | Docker | `hermes-copycat` | 8651 | @copy_cat_agent_bot | ✅ connected |
| **aquisition** | Docker | `hermes-aquisition` | 8652 | @aquisition_red_bot | ✅ connected |
| **va_agent** | Docker | `hermes-va_agent` | 8653 | @red_va_agent_bot | ✅ connected |
| **hermesrunner** | Native | `hermes-gateway-hermesrunner.service` | — | @pipou200bot (Louky) | ✅ connected |
| **arev-chantier-runner** | Native | `hermes-gateway-arev.service` | — | @Arev_Chantiers_AssistBot | ✅ connected |

> **Important correction**: `hermes-leanConstruction` initially ran with the wrong bot (@suren_construction_bot). It was recreated with its real bot **@lean_construction_bot**.

The Docker agents' tokens are stored in `/root/.fleet_tokens.env` (mode 600).

### 4.4 Native systemd Services

```bash
systemctl status hermes-gateway-hermesrunner   # Louky bot (@pipou200bot)
systemctl status hermes-gateway-arev           # Arev bot (@Arev_Chantiers_AssistBot)
journalctl -u hermes-gateway-hermesrunner -f
journalctl -u hermes-gateway-arev -f
```

Both are `enabled` (start at boot) and `Restart=always`.

### 4.5 Docker Agents (fleet v1)

> **⚠️ Legacy (v1)**: the historical fleet below remains managed by
> `spawn-hermes.sh`. The **SME pro clients** are now deployed via the
> **`HermesConfig` v2** sub-project (hardened: secrets outside YAML, loopback
> ports, pinned image, scoped vault, healthcheck) — see
> `../HermesConfig/README.md`. Do not add new clients on v1.

Deploy a new dockerized agent (v1, legacy):
```bash
# As root (the DEEPSEEK_API_KEY / TELEGRAM_USER_ID secrets are in
# /etc/secrets/hermes.env, sourced automatically by /root/.bashrc — audit 30/08)
cd /home/admin/hermes-fleet
./spawn-hermes.sh <agent_name> "<telegram_bot_token>"

# Example:
./spawn-hermes.sh myAgent "123456789:AA..."
```

The script: builds the image if needed (via `hermes-repo`), finds a free port (8650+), mounts the Obsidian vault (`/home/syncthing/obsidian-vault`), injects `DEEPSEEK_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS` and runs `hermes gateway run --replace`.

### 4.5bis HermesConfig PRO Fleet (v2) — SME clients

| Agent | Container | Port | Telegram Bot | Image | Status |
|---|---|---|---|---|---|
| **arev** (AREV Travaux) | `hermes-arev-pro` | 127.0.0.1:8655 | @ArevLeanyBot (new, option A) | `hermes-agent:v2026.5.16-522` | ✅ connected (30/08/2026) |

- Deployment/audit: `/home/admin/hermes-fleet/HermesConfig/scripts/{spawn,audit}-hermes-pro.sh`
- Secrets: `clients/arev/client.env` (600) → resolved in `instances/arev/secrets.env` (600, referenced by `env_file`) — **never in the YAML nor git**
- **Client-scoped** vault: `/home/syncthing/obsidian-vault/VPS/HermesConfig/arev/` → `/opt/vault` (10000:10000 + syncthing ACL)
- Hardening: `no-new-privileges`, `cap_drop ALL` + minimal caps, `mem_limit 2g`, `cpus 1.5`, logs 10m×3, healthcheck on `gateway_state.json`
- Audit 30/08: **12 OK / 0 FAIL** (`audit-hermes-pro.sh`)
- ⚠️ **Lesson**: do not define `TELEGRAM_FALLBACK_IPS` (direct IP TLS → certificate failure on recent builds → timeout). The native runner `arev-chantier-runner` (@Arev_Chantiers_AssistBot) remains in parallel during the transition.

### 4.5ter HermesCapabilities — modular skills track (M1, 31/08/2026)

`HermesCapabilities/` sub-project: granular capabilities (email, OCR, RAG,
analytics…) described by a `manifest.yaml` contract, unit-tested, and
attachable to instances (`capability-attach.sh`). Technical decision order:
native > mix > sidecar (matrix in `ARCHITECTURE.md`). Pilot:
`rag-supabase` (C5, native — Hermes catalogue `supabase` MCP). Real
implementation (M2): Supabase TEST schema/RPC → MCP wiring on `hermes-arev-pro`.
Future interface with v3 spawn: `integration-hermesconfig.md`.

**Bugs fixed in `spawn-hermes.sh`** (vs the original version):
- `entrypoint: []` **removed** → the image uses its native entrypoint which drops privileges to the `hermes` user (without this, the image refuses to start the gateway as root)
- Command: `gateway run --replace` (the `--no-supervise --force` options did not exist)
- The entrypoint runs `hermes gateway run --replace` automatically
- **Audit 30/08**: `chmod -R 777 "$BASE_DIR/data"` replaced by `chown -R 10000:10000 … && chmod -R 700 …` (the data-dirs are no longer world-writable)

**Model/Provider fixes (plan A — 30/08/2026)**:
- The `config.yaml` generated at first boot forced `model.default: "anthropic/claude-opus-4.6"` + `provider: auto` → HTTP 400 on the DeepSeek endpoint (invalid anthropic model).
- **Fixed**: `cli-config.yaml.example` (in `hermes-repo`) updated with `default: "deepseek-chat"` + `provider: "deepseek"`.
- The config.yaml of aquisition/copycat/va_agent were fixed manually + containers restarted.
- The script injects `HERMES_MODEL=deepseek-chat` + `HERMES_MODEL_PROVIDER=deepseek`.

### 4.6 Obsidian Vault & Syncthing

- Vault: `/home/syncthing/obsidian-vault/` (612 MB)
- Syncthing GUI: `http://127.0.0.1:8384`
- ⚠️ **Incomplete Syncthing config**: only the `$VPS_HOSTNAME` device (`$SYNCTHING_DEVICE_ID is declared, the vault has no `.stfolder`, no remote device → **no active sync**. Waiting for the device IDs of the other devices.
- UFW: port 22000 restricted to the local IP `$SOURCE_IP`
- Shortcuts: `sync-status`, `sync-restart`, `sync-reset` (aliases in `/root/.bashrc`)

---

## 5. Incident Report — Hermes Agents Unresponsive

### Root cause
After the reinstallation, **nothing was running**:
1. Docker image `hermes-agent:latest` missing
2. Native binary `hermes` missing (`/usr/local/bin/hermes` = broken link)
3. No active gateway service

### Fixes applied
1. Build of the Docker image from `hermes-repo` (full repo recovered from `arev-chantier-runner/.hermes/hermes-agent`)
2. Recovery of `docker/entrypoint.sh` from git (file missing from the working tree)
3. System installation of Hermes v0.20.6 via the official installer (+ `libatomic1`, + `python-telegram-bot==22.8`)
4. Creation of 2 dedicated systemd services + `.local/bin/hermes` links for the runners
5. Fix of `spawn-hermes.sh` + deployment of leanConstruction (Docker)
6. Reset of the corrupted `kanban.db` of arev-chantier-runner

---

## 6. TO DO — Remaining Work

### Agents / Fleet
- [x] **aquisition_bot**: deployed (token provided) → `hermes-aquisition` port 8652, @aquisition_red_bot ✅
- [x] **copycat**: deployed → `hermes-copycat` port 8651, @copy_cat_agent_bot ✅
- [x] **va_agent**: deployed → `hermes-va_agent` port 8653, @red_va_agent_bot ✅
- [x] **leanConstruction**: recreated with the right bot @lean_construction_bot (port 8650) ✅; **standardized on 01/09**: re-deployed on up-to-date image, gateway on uid 10000 (like the 3 others), data preserved (precautionary tar in `/var/backups/lean-precaution/`).
- [ ] **loukyrunner**: duplicate of hermesrunner (same bot @pipou200bot). If a distinct bot is expected, provide its token.
- [ ] Complete mapping **agent_name → token → mode** documented in `/root/.fleet_tokens.env` (mode 600).

### Infrastructure / Syncthing / nginx
- [ ] **Syncthing**: provide the **device IDs** of the devices (PC/mobile) to activate the Obsidian vault sync; declare the `obsidian-vault` folder with `.stfolder`.
- [ ] **nginx**: to be defined (usage under consideration) — not installed.

### Security
- [x] **Ports 8650-8653** (Docker agent APIs): **UFW DENY** — published ports but publicly blocked.
- [x] **Port 8642** (native gateway API): **UFW DENY**.
- [x] **Port 22000** (Syncthing): **CLOSED on 01/09** — replaced by Tailscale (enrolled server $TAILSCALE_IP; install the Tailscale app on PC/phone for future sync).
- [x] **Move the secrets from `/root/.bashrc`** to `/etc/secrets/` — **done on 30/08 (audit)**: 55 variables migrated to `/etc/secrets/hermes.env` (600), `.bashrc` set to 600 + sourcing, backup `/root/.bashrc.preaudit-20260830`.
- [ ] Enable **secret redaction** in the Hermes config (`security.redact_secrets: true`) — disabled by default.
- [ ] Change the **Contabo root password** (via VNC console) if not already done.
- [x] **Standardize the leanConstruction container**: ✅ **done on 01/09** — compose regenerated without `entrypoint: []`, image `hermes-agent:latest`, gateway on uid 10000, data `10000:10000 700`, Telegram `connected`.
- [x] **Daily backups**: ✅ **done on 01/09** — `/usr/local/bin/vps-backup.sh` (cron 4:30am, ~1.3 GB archive in `/var/backups/vps-fleet/`, 7-day retention, log `/var/log/vps-backup.log`) + automatic local pull `Installation/scripts/vps-backup-pull.sh` (schtasks task to create, see EXPLICATION_SECURITE.md) + Synology NAS as a second step (the NAS pulls over SSH, procedure documented).
- [x] **Tailscale**: ✅ **installed on 01/09** — server enrolled (`$TAILSCALE_IP`, tailnet REDACTED_EMAIL). User-side to do: install the Tailscale app on PC/phone to access services via the tailnet.
- [x] **SSH keys hardened**: ✅ **01/09** — passphrase on `$VPS_SSH_KEY` + `vps` function (SSH agent on fixed socket `~/.ssh/agent.sock`, 1× per WSL session) + GPG archive of the keys (`Installation/scripts/backup-keys.sh`, to be copied to USB).
- [ ] **Clean up the main `/etc/ssh/sshd_config`** (dead `PermitRootLogin yes` / `X11Forwarding yes`, neutralized by `00-hardening.conf` but misleading).
- [ ] **Bind the native gateway to 127.0.0.1** (defense in depth, UFW deny 8642 already in place).
- [ ] **Purge snapd residues** (`apt purge snapd`, `/snap`) and set up **AIDE logrotate** (logs > 40 MB).

### Checks / Backups
- [ ] Test **persistence after reboot** (systemd services + containers `restart: unless-stopped`).
- [ ] Verify proper syncing of the Obsidian vault via Syncthing after the first changes.
- [ ] **HermesConfig**: test a real Telegram message to @ArevLeanyBot + the agent's reply; create the Ops bot + routines after client validation.
- [ ] **HermesCapabilities**: M2 — real implementation of C5 rag-supabase (Supabase TEST → MCP on arev) then C1 email-gmail; replication of contracts C2/C3/C4/C6/C7.
- [ ] **HermesConfig**: include `/home/admin/hermes-fleet/HermesConfig/instances/` (data) + `clients/` in the backup procedure.
- [x] **AIDE**: database regenerated on 30/08 **21:34** after remediation + churn exclusions (validation check 0 diff); cron 3am → `aide-check-alert.sh` (Telegram alert **only if** differences). Redo `aideinit --force` after any major system change.
- [x] **Alert bot token rotation** — **done on 30/08 21:50**: new token in `/etc/secrets/hermes.env` (600), old one revoked (API 401), new one validated (API 200, @pipou200bot), send test OK. Backup: `/etc/secrets/hermes.env.pre-rotation-20260830`.
- [ ] Clean up the pre-audit backups on the server once stability is confirmed (`/root/.bashrc.preaudit-20260830`, `/etc/pam.d/sshd.preaudit-20260830`, `/etc/secrets/hermes.env.preaudit-quote-20260830`, `/etc/cron.d/aide.preaudit-20260830`).
- [x] **BACKUP PROCEDURE**: include **`/home/admin/hermes-fleet/`** (data + configs of the Docker agents: sessions, memories, state.db) — **missing from the original `backup.tar.gz` backup**, which caused the loss of the Docker agents' histories. Data to back up:
  - `/home/admin/hermes-fleet/` (Docker agents: `hermes-fleet/<agent>/data/`)
  - `/home/<runner>/.hermes/` (native runners: sessions, memories, state.db, .env)
  - `/root/.fleet_tokens.env`, `/etc/secrets/hermes.env` and `/root/.bashrc` (tokens + keys — the first two in 600 mode, **essential** for redeployment)
  - `/home/syncthing/obsidian-vault/` (Obsidian vault)

> **Lesson learned (plan A)**: the 4 Docker agents (leanConstruction, copycat, aquisition, va_agent) were **rebuilt from scratch** — their earlier conversation histories are NOT in the archive. Only the native runners kept their data (hermesrunner 62 sessions, loukyrunner 67, arev 4106).

---

## 7. Useful Commands (reminder)

```bash
# Connection
ssh nemo

# Agent logs
sudo journalctl -u hermes-gateway-hermesrunner -f
sudo journalctl -u hermes-gateway-arev -f
sudo docker logs hermes-leanConstruction --tail 50

# Gateway state (state file)
cat /home/hermesrunner/.hermes/gateway_state.json | python3 -m json.tool
cat /home/arev-chantier-runner/.hermes/gateway_state.json | python3 -m json.tool

# Deploy a dockerized agent
cd /home/admin/hermes-fleet && ./spawn-hermes.sh <name> "<token>"

# Syncthing
sync-status

# Security
sudo ufw status verbose
sudo fail2ban-client status sshd

# Manual Telegram alert test
sudo /usr/local/bin/telegram-alert.sh "Test" "test message"
```

---

## 8. Incident & Hardening — Sept 01 to 06, 2026

### Incident: public network frozen for 3 days (03/09 10:47 → 06/09 ~15:03)
- Symptom: public SSH, ICMP and tailnet all unreachable, but the OS alive (AIDE/backup crons ran, Telegram alerts went out). UFW/fail2ban/authorized_keys checked — **no link with our changes**.
- Exact cause not determined in the logs (no networkd/kernel entry over the window) — probable network incident on the Contabo VM/host side.
- Resolution: voluntary reboot on 06/09 at 15:03 (clean shutdown in the logs).
- **Post-reboot persistence test: PASSED** — everything came back automatically (sshd, 6 Telegram agents connected, tailscaled, fail2ban, crons).

### Hardening applied (Sept 01-06)
- **Tailscale** installed (server $TAILSCALE_IP), port 22000 closed for good.
- **Backups**: cron 4:30am → `/var/backups/vps-fleet/` (1.3 GB, 7-day retention) + dedicated restricted key (`$VPS_KEY_BACKUP`, `restrict,command=`) + automatic PC pull (`vps-backup-pull.sh` + schtasks) + Synology NAS documented.
- **SSH keys**: passphrase on `$VPS_SSH_KEY`, `vps` function (agent on fixed socket), GPG archive (`backup-keys.sh`), `authorized_keys` pruned to 2 lines.
- **@pipou200bot bot token rotated** (01/09) — ⚠️ lesson: the same token serves the native runner → also update `/home/hermesrunner/.hermes/.env` on every rotation.
- **leanConstruction standardized** (gateway uid 10000, regenerated compose).
- **AIDE v4**: exhaustive churn exclusions (apt/notifier maintenance, /run/*, swap, pro instances), daily heartbeat **🟢 OK / 🚨 NOK** on Telegram with **LLM triage (DeepSeek)** + raw fallback, logs kept 7 days (purge at 5am).
- **VNC console keyboard in AZERTY** (`/etc/vconsole.conf` KEYMAP=fr) + **2G swap** (`/swapfile`, fstab) + **fail2ban `ignoreip` $SOURCE_IP** (never accidentally ban the admin IP).

### AIDE Alert Protocol
1. 🟢 `OK` → nothing to do (maintenance/beneficial, detail in `/var/log/aide/` 7 days).
2. 🚨 `NOK` → check the listed paths: ongoing Doer session = expected (check with the agent), otherwise investigate.
3. After a deployment window: regenerate the database (`/tmp/regen-aide.sh` to be recreated if `/tmp` is purged: `aideinit --force -y` → `mv aide.db.new aide.db`).

### Obsidian Vault: agent access via ACL (Sept 06-07)
- Problem: files synced by Syncthing belong to `syncthing` (uid 112) — the `.md` files in `600` mode were **unreadable for the Docker agents (uid 10000)** (e.g. Aquisition/Fateh).
- **Retained fix: ACL** (no chown!): `setfacl -R -m u:10000:rwX` + `setfacl -R -d -m u:10000:rwX` on `/home/syncthing/obsidian-vault` (stored on disk → persistent, automatic inheritance for newly synced files).
- **Why NOT the chown 10000 proposed by the agent**: it would strip syncthing's write right → broken sync, and the problem would come back on every new file.
- Verified: read + write OK as uid 10000 in the container (`docker exec -u 10000`), syncthing `idle` intact, inheritance proven (file created by syncthing → ACL present).
- ⚠️ Misleading host test: `/home/syncthing` is in 750 → test **inside the container** (`docker exec -u 10000`), not from the host path.

### Agent 7: Alinea_icp_reviewer (Sept 06-07)
- Dedicated container `Alinea_icp_reviewer` (image `hermes-agent:latest`, **no exposed port**, `mem_limit 2g`, `no-new-privileges`), gateway uid 10000, Telegram **connected**.
- Token: dedicated bot `8976902110:…` (compose in 600). `TELEGRAM_ALLOWED_USERS/HOME_CHANNEL = 5917823647`.
- **Main model = `gemini-3.6-flash`** (native gemini provider, key in `/opt/data/.env`) — multimodal: sees images natively. Auxiliary vision + main on `gemini-3.6-flash` (⚠️ `gemini-2.5-*` → 404 for this account). `agent.max_turns: 90`. Config backup: `/opt/data/config.yaml.bak.*`.
- **`bshot` helper** (`/opt/data/bin/bshot <url> [png] [W] [H]`, persistent volume): real rendered screenshot (JS via virtual-time, desktop 1440×900 + mobile 390×844) into `/opt/data/screenshots/` → the agent analyzes them with its Gemini vision (design decisions). Required Docker flags: `--no-sandbox --disable-dev-shm-usage --user-data-dir=/tmp/…`.
- SOUL.md stub in place → **Redouane writes the final persona** in `hermes-fleet/Alinea_icp_reviewer/data/SOUL.md`.
- Integrations: nightly check (7/7 agents), fleet backup (included), AIDE (recursive data exclusion). **Vault mounted on 07/09** (`/home/syncthing/obsidian-vault:/opt/vault`, read+write via the u:10000 ACLs already in place).

### Agent 8: Bercy (Sept 07)
- Dedicated container `Bercy` (image `hermes-agent:latest`, no exposed port, mem 2g, no-new-privileges), gateway uid 10000, Telegram connected.
- Token: dedicated bot `8732547964:…` (compose 600). ALLOWED_USERS/HOME_CHANNEL = 5917823647.
- **Obsidian Vault: access RESTRICTED to the Bercy sub-folder** (07/09) — mount `/home/syncthing/obsidian-vault/Bercy:/opt/vault` (RW via u:10000 ACL): Bercy sees **only** its sub-folder, the rest of the vault is invisible (isolation by mount). The `Bercy/` folder of the vault is synced by Syncthing like the others.
- SOUL.md stub → Redouane writes the final persona in `hermes-fleet/Bercy/data/SOUL.md`.
- Integrations: nightly check (8/8 agents), fleet backup included, AIDE covered.
