# 🔐 Security Audit Report — Contabo VPS `nemo`

**Date**: 30/08/2026 | **Target**: $VPS_IP ($VPS_HOSTNAME, Ubuntu 22.04 LTS, kernel 5.15.0-190)
**Method**: Read-only checks + external dynamic tests (no configuration modification)
**Baseline**: `DOCUMENTATION_VPS.md` (documented state as of 30/08/2026)
**Audit connection**: alias `nemo` (port $VPS_SSH_PORT), key `$VPS_SSH_KEY` — note: `id_ed25519` is passphrase-protected and no SSH agent was running on the local machine; an `ssh-add` at WSL session start is recommended (local comfort, outside server scope).

---

## 1. 🟢 Validated Checkpoints (Compliant and secured)

### 1.1 SSH & SSHD Hardening — ✅ COMPLIANT
| Test | Result |
|---|---|
| Listening port | **$VPS_SSH_PORT only** (`0.0.0.0:$VPS_SSH_PORT` + `[::]:$VPS_SSH_PORT`), port 22 not listened on and **filtered externally** |
| `PermitRootLogin` | `no` (dynamic test: `ssh root@` → `Permission denied (publickey)`) |
| `PasswordAuthentication` / `KbdInteractive` | `no` / `no` (dynamic test with `PreferredAuthentications=password` → rejected, the server offers ONLY publickey) |
| `AuthenticationMethods` | `publickey` only, `MaxAuthTries 3` |
| Additional hardening | `X11Forwarding no`, `AllowTcpForwarding no`, `AllowAgentForwarding no`, `UseDNS no`, `PermitEmptyPasswords no` |
| Permissions | `/home/admin/.ssh` = **700**, `authorized_keys` = **600** ✅ |
| Effective config | Applied via `/etc/ssh/sshd_config.d/00-hardening.conf` (takes precedence over the main file) |

### 1.2 Network & Firewall — ✅ COMPLIANT
| Test | Result |
|---|---|
| UFW | `active`, default `deny incoming` / `allow outgoing` / `deny routed` |
| Open rules | `$VPS_SSH_PORT/tcp ALLOW`, `22000/tcp ALLOW **from $SOURCE_IP only**` |
| Hermes ports | `8642 DENY`, `8650 DENY` (explicit) |
| Docker bypassing UFW | **Neutralized**: `DOCKER-USER` chain active → RETURN for RFC1918/loopback/ESTABLISHED, **DROP for everything else** (6,300+ packets processed) |
| External probes (from a remote machine) | 22, 25, 8384, 8642, 8650, **8651, 8652, 8653**, 22000 → all **FILTERED**; $VPS_SSH_PORT → only OPEN port |
| Syncthing | GUI bound to `127.0.0.1:8384` ✅ ; `22000` exposed but UFW-restricted to 1 IP (doc TO DO **applied**) |
| Postfix | `inet_interfaces = loopback-only`, listening on `127.0.0.1:25` and `[::1]:25` exclusively ✅ |

### 1.3 Anti-Intrusion — ✅ COMPLIANT
| Test | Result |
|---|---|
| Fail2ban | Service active, 1 `sshd` jail: port **$VPS_SSH_PORT**, systemd backend, `maxretry 3`, `bantime 86400` (24h), `banaction ufw` |
| Proven effectiveness | **2 IPs currently banned** (41.63.63.211, 47.80.59.134) = the 2 `REJECT` UFW rules → fail2ban→UFW chain operational |
| AIDE | `99_custom` present with relevant exclusions (node_modules, venv, git, docker, containerd, tmp, var/log) |
| AIDE database | `aide.db` **regenerated on 30/08 at 11:56** (post-changes → doc TO DO **applied**, false alerts avoided) |
| AIDE cron | Daily at 3am (`/etc/cron.d/aide`), last check OK (10 min 49 s) |

### 1.4 Hermes Fleet — ✅ COMPLIANT (6/6 agents active)
| Agent | Mode | State |
|---|---|---|
| leanConstruction | Docker (port 8650) | `Up`, `restart=unless-stopped`, gateway starts, agent runs tools |
| copycat | Docker (8651) | `Up`, `restart=unless-stopped` |
| aquisition | Docker (8652) | `Up`, `restart=unless-stopped` |
| va_agent | Docker (8653) | `Up`, `restart=unless-stopped` |
| hermesrunner (@pipou200bot) | Native `hermes-gateway-hermesrunner` | `active` + `enabled`, Telegram `connected`, v0.20.6 |
| arev-chantier-runner (@Arev_Chantiers_AssistBot) | Native `hermes-gateway-arev` | `active` + `enabled`, Telegram `connected`, v0.20.6 |

- **Telegram polling conflict: NONE** — only 2 native gateway processes running (hermesrunner + arev); `loukyrunner` has neither systemd service nor crontab; **0 409/Conflict error** in the logs over the last 2 hours. The documented duplicate is indeed neutralized.
- Docker daemon: `no-new-privileges: true`, `live-restore`, logs 10 MB × 3 ✅
- Script `spawn-hermes.sh`: present, `-rwxr-xr-x root root` (755) ✅, token passed as argument (no hardcoded secret).
- Bonus TO DO applied: the `aquisition`, `va_agent` and `copycat` agents (marked "no trace" in the doc) are now deployed and functional.

### 1.5 System Isolation — ✅ COMPLIANT
| Component | State |
|---|---|
| snapd | `disabled` + `inactive` ✅ |
| sysctl (`99-hardening.conf`) | `kptr_restrict=2`, `dmesg_restrict=1`, `perf_event_paranoid=3`, `unprivileged_bpf_disabled=1`, `yama.ptrace_scope=2`, `rp_filter`, `tcp_syncookies`, redirects off, `fs.protected_hardlinks/symlinks` — **runtime values confirmed by `sysctl -n`** ✅ |
| Unattended-upgrades | `enabled`, `Update-Package-Lists=1`, `Unattended-Upgrade=1` ✅ |
| Docker daemon.json | Compliant with doc (`no-new-privileges`, no userns-remap by design) ✅ |

---

## 2. 🟡 Warnings / Minor improvements

| # | Finding | Recommendation |
|---|---|---|
| Y1 | **AIDE cron**: **hardcoded** log filename `aide-20260830.log` → each daily run overwrites the same file (the "date" never changes) | Use `/var/log/aide/aide-$(date +\%Y\%m\%d).log` + logrotate rotation |
| Y2 | **Main `/etc/ssh/sshd_config`** still contains `PermitRootLogin yes` / `X11Forwarding yes` (neutralized by `00-hardening.conf`, but misleading for a future edit) | Clean the main file to keep a single source of truth |
| Y3 | **Native** Hermes gateway listens on `0.0.0.0:8642` (protected by UFW `deny 8642`, verified filtered externally) | Defense-in-depth: bind to `127.0.0.1` in the native service config |
| Y4 | **`spawn-hermes.sh`** does `chmod -R 777 "$BASE_DIR/data"` (world-writable directories) | Replace with `chmod -R 750` or `770` + appropriate owner (the container user is 10000) |
| Y5 | `hermes-gateway.service` residue **not-found/failed** in `systemctl list-units` | `sudo systemctl reset-failed` (cosmetic) |
| Y6 | fail2ban `jail.local`: `logpath = /var/log/auth.log` useless with `backend = systemd` (ignored) | Remove the line to avoid confusion |
| Y7 | `/root/.bashrc` in mode **644** | Change to **600** (reduces the attack surface if /root permissions were ever loosened) |
| Y8 | Snap residues (`/snap`: core22, lxd) after deactivation | Purge: `apt purge snapd` + remove `/snap` if not required |
| Y9 | Telegram tokens passed as `docker run` argument (visible via `docker inspect` / `ps` as root) | Acceptable (access limited to admin/root); alternative: `--env-file` 600 |
| Y10 | Residual users: `hermes` (locked, doc says "unused"), `loukyrunner` (duplicate, locked) | Delete if definitively abandoned: `userdel -r` |
| Y11 | `kernel.kexec_load_disabled = 0` (not configured) | Optional: add `kernel.kexec_load_disabled=1` to `99-hardening.conf` |
| Y12 | Large AIDE logs (aide.log 87 MB, run log 44 MB) | Set up logrotate on `/var/log/aide/` |

---

## 3. 🔴 Red flags / Major inconsistencies to fix immediately

### 🔴 R1 — Undocumented root-equivalent door: `ubuntu` user (cloud-init)
**Discovery outside the doc** (section §2 of `DOCUMENTATION_VPS.md` does not mention it):
- User `ubuntu` (uid 1000, shell `/bin/bash`), locked password (`passwd -S` → `L`)
- **`/home/ubuntu/.ssh/authorized_keys` present** (injected by cloud-init at reinstallation, identical key to `admin`'s)
- **`ubuntu ALL=(ALL) NOPASSWD:ALL`** in `/etc/sudoers.d/90-cloud-init-users`

→ Anyone/any procedure in possession of the admin private key can open a **second root-equivalent session** via `ssh ubuntu@`, bypassing the documented access model (admin only). This is not an external exposure (still protected by the key), but it is a hardening inconsistency: an unaudited root channel, unmonitored by the documented jail, and invisible in the doc.

**Immediate fix**:
```bash
sudo userdel -r ubuntu
sudo rm /etc/sudoers.d/90-cloud-init-users
```
(or at minimum: empty `/home/ubuntu/.ssh/authorized_keys` and remove the sudoers rule)

### 🔴 R2 — ~40 secrets in plaintext in `/root/.bashrc`; `/etc/secrets/` empty (doc TO DO not applied)
- `/etc/secrets/` does exist (700 root) but is **EMPTY** → direct inconsistency with the doc ("Secrets: /etc/secrets (700, root)").
- `/root/.bashrc` contains in plaintext: `DEEPSEEK_API_KEY`, `SUPABASE_SERVICE_KEY` (+ `PROD_SUPABASE_SERVICE_KEY`), `PROD_JWT_SECRET`, `TEST_JWT_SECRET`, `GITHUB_TOKEN`, `GITEA_TOKEN`, prod/test Telegram tokens (@suren_construction_bot), Cloudflare credentials (GED), Gmail OAuth (client secret + **refresh token**), `SUREN_TEST_LOGIN`/`SUREN_TEST_PASSWORD`, OpenRouter/Gemini keys, etc.
- Mitigations observed: `/root` in **700** (thus unreadable by other local users), server with no exposed web service. Residual risk: leak via versioning/backup of the bashrc, injection into containers (`DEEPSEEK_API_KEY` is sourced from this file for `spawn-hermes.sh`), and exfiltration in case of root compromise (which AIDE/fail2ban do not prevent).

**Priority fix**:
```bash
# Extract the secrets to /etc/secrets (one file per var, 600 root)
sudo install -m 600 /dev/null /etc/secrets/hermes.env   # then move the exports there
# In /root/.bashrc, replace the secret blocks with:  . /etc/secrets/hermes.env
sudo chmod 600 /root/.bashrc
```

---

## 4. 📋 Overall verdict: ~~TO BE FIXED~~ → **VALIDATED** (remediation applied on 30/08, see §5)

> **Post-audit update**: the 2 red flags (R1, R2) and warnings Y1/Y4/Y5/Y7 were **fixed on 30/08/2026** and re-validated (see section 5). The initial audit verdict was "TO BE FIXED (minor — no network exposure)".

| Scope | Status |
|---|---|
| SSH/SSHD | ✅ Validated (dynamic tests included) |
| Network/UFW/Docker | ✅ Validated (DOCKER-USER operational, 9 ports tested closed externally) |
| Fail2ban | ✅ Validated (active bans proven) |
| AIDE | ✅ Validated (database up to date) — 🟡 cron log bug |
| Hermes Fleet (6 agents) | ✅ Validated (zero polling conflict) |
| Secrets & isolation | 🔴 R1 + R2 |

**Summary**: The documented hardening is **real and verified under dynamic conditions** — all simulated intrusion tests (root, password, 9 ports) fail as expected, Docker does not bypass UFW, fail2ban has already proven its effectiveness (2 bans). The Hermes fleet is 100% operational (4 Docker + 2 native) without Telegram conflict. The two red flags are **simple to fix (< 10 min)** and concern residual identity management (cloud-init `ubuntu` user) and secrets hygiene — neither currently exposes the server, but R1 must be addressed first because it creates an undocumented root channel.

**Suggested remediation checklist**:
1. ✅ Delete `ubuntu` + its sudoers rule (R1) — **done on 30/08**
2. ✅ Migrate the secrets from `/root/.bashrc` to `/etc/secrets/` (R2) + `chmod 600 /root/.bashrc` — **done on 30/08**
3. ✅ Fix the AIDE cron (dynamic log name) — **done on 30/08**
4. ✅ Clean the main `sshd_config` (🟡 Y2, still to do), `reset-failed` the residual service (done), data-dir in spawn-hermes.sh (done)
5. ✅ Update `DOCUMENTATION_VPS.md` (§2 users, §3 secrets, §4.3 fleet, §6 TO DO) — **done on 30/08**

---

## 5. ✅ Remediation applied and re-validated (30/08/2026)

Remediation executed in a single `sudo bash -s` session over SSH, with backups and abort points (automatic rollback on syntax error). No service interruption observed (fleet 6/6 operational after intervention).

### 5.1 R1 + R2 + minor fixes — detail

| # | Action | Re-validated result |
|---|---|---|
| **R1** | `userdel -r ubuntu` + removal of `/etc/sudoers.d/90-cloud-init-users` | `id ubuntu` → nonexistent, `/home/ubuntu` deleted, `visudo -c` OK, only `90-admin` remains |
| **R2** | Migration of **55 variables** (49 + 6 with digits in the name) from `/root/.bashrc` to `/etc/secrets/hermes.env` (600, root) ; `.bashrc` (now **600**) ends with the kept sourcing `[ -f /etc/secrets/hermes.env ] && . /etc/secrets/hermes.env` ; backup `/root/.bashrc.preaudit-20260830` kept | `0` remaining `export` line in `.bashrc` ; `bash -n` OK on both files ; interactive root shell: `DEEPSEEK_API_KEY`, `TELEGRAM_USER_ID`, `SUREN_GOOGLE_GEMINI_CREDENTIALS_B64`, `E2E_BOT_TOKEN` → **LOADED** (test by name, values never displayed) |
| **Y1** | Rewrite of `/etc/cron.d/aide`: dynamic dated log with `%` **escaped** (`aide-$(date +\%Y\%m\%d).log`) | Valid cron line (an unescaped `%` would have broken the crontab) |
| **Y4** | `spawn-hermes.sh`: `chmod -R 777` replaced by `chown -R 10000:10000 … && chmod -R 700 …` | Applied to **future** deployments ; the 4 existing data-dirs were already at `700` (Doer work 13:26-13:28), stricter than expected — left untouched |
| **Y5** | `systemctl reset-failed` (`hermes-gateway.service` residue) | `0 failed units` |
| **Y7** | `chmod 600 /root/.bashrc` (+ 600 backup) | Confirmed by `stat` |

### 5.2 Deliberate deviations from the proposed remediation block

1. **R2 completion**: the proposed `grep` (`DEEPSEEK|TELEGRAM|SUPABASE|JWT|...`) forgot ~10 secrets (`PROD_JWT_SECRET`, `TEST_SUPABASE_SERVICE_KEY`, `LOUKI_DEEP_SEEK_API_KEY`, `TOOLS_API_KEY`, `DATABASE_URL`, `E2E`/`B64`/`S3` variables...) and **did not remove the secrets from `.bashrc`** (mere copy = duplication). The migration moved **all** the `export` lines (pattern with `[A-Za-z_0-9]`) and made the centralized file sourced — `spawn-hermes.sh` (run in an interactive root shell) keeps working identically.
2. **Y1**: raw `$(date +%Y%m%d)` in a cron is invalid (the `%` is a special crontab character) → `\%`.
3. **Y4**: `chmod -R 750` would have **blocked container writes** (uid 10000 neither owner nor group) → `chown 10000:10000` + `chmod 700`, aligned with the observed state of the data-dirs.

### 5.3 Additional post-remediation observations (new 🟡)

- **N-Y13**: the `hermes-leanConstruction` container runs its gateway **as root** (uid 0 in the container — hence the `root:root 700` files of its data-dir), unlike the 3 other containers (uid 10000). Recommendation: rebuild/re-run with `USER 10000` (Dockerfile) or `docker run --user 10000` after `chown -R 10000:10000` of the data-dir, to standardize.
- **N-Y14**: the next AIDE run (3am) will report the expected diffs (`.bashrc`, `/etc/secrets/`, `/etc/cron.d/aide`, `spawn-hermes.sh`, deletion of `/home/ubuntu`) → after verification, regenerate the database (`aideinit --force`) to start clean.
- **N-Y15**: warnings Y2 (main `sshd_config`: dead but misleading `PermitRootLogin yes`), Y3 (bind `127.0.0.1` of the native gateway), Y6/Y8-Y12 remain open (minor).

### 5.4 Final security state (re-validation after remediation)

| Control | State |
|---|---|
| Root-equivalent users | **A single one**: `admin` (NOPASSWD via `90-admin`) — `ubuntu` door closed |
| Secrets | **0 in plaintext** in `.bashrc` ; centralized in `/etc/secrets/hermes.env` (600, dir 700) |
| Hermes Fleet | 6/6 active (4 Docker + 2 native), fail2ban active, 0 failed unit |
| Network exposure | unchanged and compliant ($VPS_SSH_PORT only public) |

### 5.5 Active Telegram Monitoring (30/08, post-audit addition)

Centralized alert architecture deployed and validated end to end:

| Component | Role | Validation |
|---|---|---|
| `/usr/local/bin/telegram-alert.sh` (700 root) | Centralized Telegram sending ; credentials sourced from `/etc/secrets/hermes.env` (`ALERT_TELEGRAM_BOT_TOKEN`, `ALERT_TELEGRAM_CHAT_ID`) ; errors logged via `logger -t telegram-alert` | Direct test **HTTP 200** ; messages received on Telegram |
| `/usr/local/bin/telegram-alert-ssh.sh` + PAM hook (`/etc/pam.d/sshd`: `session optional pam_exec.so quiet seteuid …`) | Notifies **only unusual SSH logins**: IP other than `SSH_ALERT_ALLOWED_IPS` (`$SOURCE_IP`, allowlist in `hermes.env`), user other than `admin`, or local login — silence for `admin@$SOURCE_IP` (routine agent traffic, traced in `journalctl`) ; `optional` = can never block a login ; backups `sshd.preaudit-20260830` / `telegram-alert-ssh.sh.preaudit-policy-20260830` | Simulation `admin@$SOURCE_IP` → silence (exit 0) ; `admin@203.0.113.99` (test IP) → notification received ; `close_session` → silence |
| `/usr/local/bin/aide-check-alert.sh` (cron 3am via `/etc/cron.d/aide`) | Daily AIDE check → Telegram alert **only if** files added/deleted/modified (otherwise silence) | Chain validated: alerts went out during out-of-band checks (received), silence after clean database |

**Fixes imposed by the implementation**:
1. **`hermes.env` rebuilt**: the raw exported lines from `.bashrc` contained unexpanded references (`DATABASE_URL` with `$p` → fatal `unbound variable` under `set -u` in scripts) → values captured from the real environment of a root shell, escaped with `printf %q`, deduplicated (57→50 lines), sourcing validated under `set -u`. Backup: `/etc/secrets/hermes.env.preaudit-quote-20260830`.
2. **Churn exclusions added to `99_custom`** (otherwise nightly false alerts guaranteed — 97 diffs measured at the 1st check): Docker agent data-dirs (`hermes-fleet/*/data`), `.hermes` of the 3 users (hermesrunner, arev-chantier-runner, admin: states/sessions/logs/tickers), Syncthing index, `fail2ban.sqlite3`, landscape cache, Obsidian vault (synced user content), `/run/containerd`. AIDE continues to cover binaries, system configs, scripts and sudoers.
3. **AIDE database regenerated** (21:34) and validation check **100% clean** (0 added / 0 deleted / 0 modified, 6 min) → the 3am cron restarts on a sound database.

**Observations**: concurrent activity detected during the operation (creation of `/home/admin/.hermes` at 21:14:30 — Doer session), accounted for by the exclusions. Verification of the local git repo initialized the same day: **no secrets in the history** (alert token absent, `spawn-hermes.sh` only references variable names). ✅ **Alert token rotation performed on 30/08 21:50** (transiently in plaintext in the conversation): old token confirmed revoked (API 401), new one validated (API 200, @pipou200bot), send test OK, 600 permissions kept, backup `/etc/secrets/hermes.env.pre-rotation-20260830`. Note: the alert bot is @pipou200bot, the same as the native runner hermesrunner — without conflict (the script only uses `sendMessage`, the gateway only `getUpdates`).

---
*Audit report generated in read-only mode; the remediation (§5) and the monitoring (§5.5) were applied and re-validated on 30/08/2026.*
