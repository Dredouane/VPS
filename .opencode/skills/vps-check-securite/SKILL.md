---
name: vps-check-securite
description: >-
  Security non-regression audit of the nemo VPS ($VPS_IP, SSH read-only):
  sshd (port $VPS_SSH_PORT, root/password disabled, ciphers without weak algo, drop-ins),
  UFW (default deny, $VPS_SSH_PORT only open port, 8642/8650 DENY, 22000 CLOSED,
  DOCKER-USER), Fail2ban (sshd jail), AIDE (base + cron aide-check-alert.sh +
  99_custom), daily backups (vps-backup.sh), Tailscale (enrollment),
  Docker daemon.json, secrets /etc/secrets/hermes.env (600), PAM SSH hook
  (IP allowlist), hardened sysctl, postfix loopback, snapd, unattended-upgrades,
  sudoers. Use when the user says "check sécurité", "vps-check-securite",
  "vérifier le hardening", "non-régression sécurité", "audit sécurité", or as
  part of vps-check-full.
---

# Security check — VPS hardening audit (SSH read-only)

**Read-only** audit of the `nemo` VPS (admin@$VPS_IP:$VPS_SSH_PORT, key
`$VPS_SSH_KEY` via `~/.ssh/config`), baseline = validated state of 30/08/2026
(`Installation/RAPPORT_AUDIT_2026-08-30.md` §1 + §5).
Absolute rules:

1. **Strict READ-ONLY**: forbidden server-side — `rm`, `sed -i`,
   `systemctl restart/enable/disable/reset-failed`, `ufw allow/deny/delete`,
   `fail2ban-client` (action), `aideinit`, `setfacl`, `chmod/chown`, `userdel`,
   and any file write. The skill reports, it never fixes.
2. **No secret displayed**: values of `hermes.env`, tokens, keys → never
   in the output. Check by **counting** (`grep -c`) or presence (`test -n`).
3. Output: table `| Check | Statut | Detail |` with `✓ PASS` / `✗ FAIL` /
   `~ WARN` / `⏭ SKIP` + global verdict (SAIN / ACTION REQUISE).
4. FAIL → point to the remediation (§Remediation), apply nothing.

## Connection

```bash
SSH="ssh -o BatchMode=yes -o ConnectTimeout=8 nemo"
```

Preliminary probe: `$SSH 'echo ok'` → if it fails (timeout, key refused):
**all checks S1-S30 = SKIP**, conclude the report with the note
"VPS unreachable — remote checks skipped".

The checks R1-R4 (local repo) do not depend on SSH — see the
`vps-check-repo` skill to run them in parallel.

## Checks — SSH (server)

| # | Check | Command (`$SSH '…'`) | Expected (baseline 30/08) |
|---|---|---|---|
| S1 | SSH port | `sudo ss -tlnp \| grep sshd` | `0.0.0.0:$VPS_SSH_PORT` + `[::]:$VPS_SSH_PORT` only, **no `:22`** |
| S2 | PermitRootLogin | `sudo sshd -T \| grep -i permitrootlogin` | `no` |
| S3 | PasswordAuthentication | `sudo sshd -T \| grep -i passwordauthentication` | `no` |
| S4 | KbdInteractiveAuthentication | `sudo sshd -T \| grep -i kbdinteractiveauthentication` | `no` |
| S5 | PubkeyAuthentication | `sudo sshd -T \| grep -i pubkeyauthentication` | `yes` |
| S6 | AuthenticationMethods | `sudo sshd -T \| grep -i authenticationmethods` | `publickey` |
| S7 | MaxAuthTries | `sudo sshd -T \| grep -i maxauthtries` | `3` |
| S8 | Forwards / DNS / X11 / empty pwd | `sudo sshd -T \| grep -Ei 'allowtcpforwarding\|allowagentforwarding\|usedns\|x11forwarding\|permitemptypasswords'` | `allowtcpforwarding local` (intentional: `10-tunnel.conf`, `$VPS_TUNNEL` tunnels — ⚠️ §1.1 of RAPPORT_AUDIT wrongly says « no ») ; `allowagentforwarding no`, `usedns no`, `x11forwarding no`, `permitemptypasswords no` |
| S9 | Ciphers/MACs without weak algo | `sudo sshd -T \| grep -E '^(ciphers\|macs) '` | **0** occurrence of `arcfour`, `hmac-sha1`, `hmac-md5` (grep -cE → 0); `chacha20-poly1305@openssh.com` allowed (modern), AES-GCM + hmac-sha2-ETM present |
| S10 | SSH drop-ins | `ls /etc/ssh/sshd_config.d/` | `00-hardening.conf` present (loaded 1st → first-match-wins); residual cloud-init drop-ins tolerated (`50-cloud-init.conf` contains `PasswordAuthentication yes` **inert** — neutralized by sshd -T; `60-cloudimg-settings.conf` = `no`) → documentary `~ WARN` (extends Y2) |
| S11 | admin `.ssh` perms | `stat -c '%a' /home/admin/.ssh /home/admin/.ssh/authorized_keys` | `700` and `600` |

## Checks — Network / UFW / Docker

| # | Check | Command | Expected |
|---|---|---|---|
| S12 | UFW active | `sudo ufw status` | `Status: active` |
| S13 | Default policy | `sudo ufw status verbose` | `Default: deny (incoming)` |
| S14 | Open rules | `sudo ufw status \| grep -E '$VPS_SSH_PORT\|8642\|8650\|22000'` | `$VPS_SSH_PORT/tcp ALLOW`; `8642/tcp DENY`; `8650/tcp DENY`; **22000: NO rule** (closed on 01/09 — replaced by Tailscale, see `EXPLICATION_SECURITE.md` §7.3) — any residual 22000 ALLOW rule = **FAIL** |
| S15 | UFW/Docker block | `sudo grep -c 'BEGIN UFW AND DOCKER' /etc/ufw/after.rules` | ≥ 1 (block present — critical: Docker bypasses UFW) |
| S16 | DOCKER-USER chain | `sudo iptables -L DOCKER-USER -n` | contains a final `DROP` rule (RFC1918/loopback/ESTABLISHED RETURN tolerated) |
| S17 | daemon.json | `cat /etc/docker/daemon.json` | `no-new-privileges: true`, `live-restore: true`, log-opts `max-size 10m` / `max-file 3`, **no** `userns-remap` key |

⚠️ UFW also lists **dynamic** `REJECT` rules (fail2ban) — never match
a complete frozen list of rules, only the rules above.

## Checks — Fail2ban & AIDE

| # | Check | Command | Expected |
|---|---|---|---|
| S18 | fail2ban service | `systemctl is-active fail2ban` | `active` |
| S19 | sshd jail | `sudo fail2ban-client status` (list) + `sudo fail2ban-client get sshd bantime` + `sudo grep -E '^(port\|bantime\|backend\|banaction)' /etc/fail2ban/jail.local` | `sshd` jail present; bantime **effective** `86400`; `port = $VPS_SSH_PORT`, `backend = systemd`, `banaction = ufw` — a `bantime = 3600` at the top ([DEFAULT]) is tolerated if the [sshd] section prevails |
| S20 | AIDE base | `stat -c '%a' /var/lib/aide/aide.db` | present, `600` |
| S21 | AIDE cron (heartbeat 🟢/🚨) | `cat /etc/cron.d/aide` + `sudo head -5 /usr/local/bin/aide-check-alert.sh` | scheduled at 3am (`0 3 * * *`) calling `/usr/local/bin/aide-check-alert.sh` (v4+): each check sends Telegram **🟢 OK** (0 diffs or benign diffs via LLM triage) or **🚨 NOK** (suspect diffs + explanations); raw fallback if the LLM API fails; full details in `/var/log/aide/` (kept 7 d, cron purge at 5am) |
| S22 | `99_custom` churn exclusions | `cat /etc/aide/aide.conf.d/99_custom` | contains: `node_modules` (agents + global), `/var/lib/docker`, `containerd`, data-dirs `hermes-fleet/.*/data` (recursive — pro instances included), `.hermes` of the 3 users (or pattern `admin\|hermesrunner\|arev`), `syncthing`, `fail2ban`, `landscape`, `/run/containerd`, `/run/docker`, `/var/lib/aide`, `/var/lib/tailscale`, `/var/backups`, `obsidian-vault`, `/var/cache/apt`, `/var/cache/motd-news`, `/var/lib/apt`, `/var/lib/ubuntu-advantage`, `/var/lib/update-notifier`, `/var/lib/update-manager`, `/var/lib/ubuntu-release-upgrader`, `/var/lib/systemd/timers`, `/run/systemd`, `/run/user`, `/run/ufw.lock`, `/swapfile` (grep by keyword, ≥ 15 patterns) |
| S23 | Last AIDE check | `ls -lt /var/log/aide/ \| head -3` | recent log (< 26 h), logs kept **7 days** (cron purge at 5am) — if `found differences` in the last log → `~ WARN` to investigate (may be legitimate after a voluntary change or a Doer deployment window — see §5.5 protocol) |

## Checks — Secrets & users

| # | Check | Command | Expected |
|---|---|---|---|
| S24 | /etc/secrets perms | `sudo stat -c '%a %U:%G' /etc/secrets /etc/secrets/hermes.env` | `700 root:root` and `600 root:root` |
| S25 | Valid sourcing | `sudo bash -uc '. /etc/secrets/hermes.env && echo OK'` | `OK`, no `unbound variable` |
| S26 | Variables present (names only) | `sudo grep -cE '^[[:space:]]*(export[[:space:]]+)?(DEEPSEEK_API_KEY\|ALERT_TELEGRAM_BOT_TOKEN\|ALERT_TELEGRAM_CHAT_ID\|SSH_ALERT_ALLOWED_IPS)=' /etc/secrets/hermes.env` | `4` — lines use the `export VAR=…` format (§5.1 migration); **never display the values** |
| S27 | 0 export in .bashrc | `sudo grep -c '^export' /root/.bashrc` + `sudo stat -c '%a' /root/.bashrc` | `0` and `600` |
| S28 | Fleet tokens | `sudo stat -c '%a' /root/.fleet_tokens.env` | `600` |
| S29 | ubuntu user removed | `id ubuntu` | nonexistent (rc≠0) |
| S30 | Hardened sudoers | `sudo ls /etc/sudoers.d/` | `90-admin` present, `90-cloud-init-users` **absent** |
| S31 | PAM SSH hook | `grep pam_exec /etc/pam.d/sshd` | contains `session optional pam_exec.so quiet seteuid /usr/local/bin/telegram-alert-ssh.sh` |
| S32 | Alert scripts | `sudo stat -c '%a %U:%G' /usr/local/bin/telegram-alert.sh /usr/local/bin/telegram-alert-ssh.sh /usr/local/bin/aide-check-alert.sh` | `700 root:root` ×3 |

## Checks — System isolation

| # | Check | Command | Expected |
|---|---|---|---|
| S33 | Postfix loopback | `grep ^inet_interfaces /etc/postfix/main.cf` + `sudo ss -tlnp \| grep ':25 '` | `loopback-only`; listens on `127.0.0.1:25` and `[::1]:25` only |
| S34 | snapd disabled | `systemctl is-enabled snapd` + `is-active snapd` | `disabled` + `inactive` |
| S35 | Hardened sysctl (runtime) | `sysctl -n kernel.kptr_restrict kernel.dmesg_restrict kernel.perf_event_paranoid kernel.yama.ptrace_scope kernel.unprivileged_bpf_disabled` | `2`, `1`, `3`, `2`, `1` |
| S36 | Unattended-upgrades | `systemctl is-enabled unattended-upgrades` | `enabled` |

## Checks — Backups & Tailscale (01/09/2026)

| # | Check | Command | Expected |
|---|---|---|---|
| S37 | Daily backup | `ls -la /etc/cron.d/vps-backup` + `cat /etc/cron.d/vps-backup` + `sudo stat -c '%a %U:%G' /usr/local/bin/vps-backup.sh` + `ls -1t /var/backups/vps-fleet/fleet-*.tar.gz \| head -1` (mtime < 26 h) + `tail -3 /var/log/vps-backup.log` | cron `30 4 * * * root`; script `700 root:root`; recent archive 600; log without errors |
| S38 | Tailscale enrolled | `systemctl is-active tailscaled` + `sudo tailscale status \| head -2` + `sudo tailscale ip -4` | `active`; server line `$VPS_HOSTNAME` logged-in; IP **$TAILSCALE_IP** |
| S39 | Backup key restricted | `sudo grep backup-pull-nemo /home/admin/.ssh/authorized_keys` + `stat -c '%a' /usr/local/bin/vps-backup-serve.sh` + `sudo ls ~/.ssh/$VPS_KEY_BACKUP 2>&1` | `restrict,command="/usr/local/bin/vps-backup-serve.sh"` line present; script `755`; private key **ABSENT from the server** (it exists only on the local PC — FAIL if found) |

## Report

1. Final table `| Check | Statut | Detail |` grouped by domain
   (SSH, UFW/Docker, Fail2ban/AIDE, Secrets/Users, Isolation).
2. Interpret each FAIL (which baseline point of 30/08 drifted).
3. Global verdict: **SAIN** if 0 FAIL, otherwise **ACTION REQUISE**.
4. Reminder: report regressions, fix nothing.

## Remediation (on FAIL)

| Domain | Reference |
|---|---|
| SSH (S1-S11) | `Installation/DOCUMENTATION_VPS.md` §3 (Security/Hardening) + `Installation/VPS_HARDENING_PLAN_FINAL.md` §3 |
| UFW/Docker (S12-S17) | `Installation/DOCUMENTATION_VPS.md` §3 + `Installation/VPS_HARDENING_PLAN_FINAL.md` §5-§6 (DOCKER-USER rules, daemon.json) |
| Fail2ban (S18-S19) | `Installation/VPS_HARDENING_PLAN_FINAL.md` §4 |
| AIDE (S20-S23) | `Installation/RAPPORT_AUDIT_2026-08-30.md` §5.5 (churn exclusions, base regeneration) + `DOCUMENTATION_VPS.md` §3 |
| Secrets/users (S24-S30) | `Installation/RAPPORT_AUDIT_2026-08-30.md` §5.1 (R1/R2: /etc/secrets migration, ubuntu removal) |
| Monitoring/PAM (S31-S32) | `Installation/RAPPORT_AUDIT_2026-08-30.md` §5.5 |
| Isolation (S33-S36) | `Installation/RAPPORT_AUDIT_2026-08-30.md` §1.5 + `DOCUMENTATION_VPS.md` §6 (Security TO DO) |
| Backups/Tailscale/backup key (S37-S39) | `Installation/EXPLICATION_SECURITE.md` §4 (points 2-3-4) + §7 (procedures) |
