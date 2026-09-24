# 🛡️ Security Explanation — VPS nemo (before / after)

> Why the server was destroyed, what changed, and why it is now
> demonstrably harder to attack. Written after the 30/08/2026 audit + remediation,
> completed on 01/09/2026 (last 4 points resolved).

---

## 1. Before: a house with the keys under the doormat

Three **combined** fatal weaknesses:

| Weakness | Why it was fatal |
|---|---|
| **SSH port 22, root + password** | Thousands of bots scan the internet 24/7 and try passwords on port 22. A weak password = compromise within hours. And `root` = the account that controls EVERYTHING. |
| **nginx exposed on the only open port** | An exposed web service = a complex program facing the world. A SINGLE flaw (old version, bad config) is enough for direct access, without a password. |
| **All the secrets in `.bashrc`** | The gravest. Once inside, the attacker could read everything: DeepSeek/OpenRouter/Gemini keys, Telegram tokens, Supabase passwords, prod JWT, Gmail OAuth. These keys give access to the cloud accounts **even after reinstallation** — secret theft survives the destruction of the machine. |

And above all: **no detection**. No structured firewall, no banning, no integrity checking, no alerting.

### The likely attack scenario
```
port 22 scan → brute force (or nginx flaw) → shell → .bashrc read
→ cloud key reuse + payload installation (mining) → destruction
```
The only possible "response" was reinstallation — proof that there was neither alarm nor containment.

---

## 2. Now: defense in depth

The principle is no longer "one secured door" but **layers that back each other up** — each layer assumes the previous one can be breached:

| Layer | Before | Now |
|---|---|---|
| 🚪 **The door** | port 22, root, password | Port **$VPS_SSH_PORT**, **key only** (impossible to type a password), root **forbidden**, 3 attempts max, forwarding forbidden. A port 22 scan no longer even finds a door. |
| 🧱 **The walls** | nginx exposed, Docker bypassing the firewall | **UFW denies everything by default** + `DOCKER-USER` chain preventing Docker from bypassing UFW. Only reachable: $VPS_SSH_PORT + Syncthing (reserved for the local IP). nginx removed. |
| 🏦 **The vault** | secrets in `.bashrc` | Secrets in `/etc/secrets/hermes.env` (600, root only), `.bashrc` locked to 600, bot token **rotated** after exposure. |
| 🚨 **The alarm** | nothing | **fail2ban** (bans for 24 h — 2 IPs already banned), **PAM hook** (Telegram alert on unusual SSH login), **AIDE** (Telegram alert if a system file is altered). |
| 🔒 **Compartmentalization** | everything as root | Agents in unprivileged containers (`no-new-privileges`, uid 10000), native gateways under dedicated users, a single sudo account (`admin`), cloud-init `ubuntu` back door **removed**. |
| 🔧 **Maintenance** | nothing | Automatic security patches (unattended-upgrades), kernel hardening (sysctl), snapd disabled. |

---

## 3. Demonstrations of 30/08 (we attacked to verify)

- `root` login → **rejected** (the server only offers the public key)
- Password login → **rejected**
- 9 ports probed **from the outside** (22, 25, 8384, 8642, 8650-8653, 22000) → **all closed**; only $VPS_SSH_PORT open
- fail2ban with **2 IPs banned** at audit time (the ban→UFW chain is proven)
- Telegram alerts **actually received** (logins, AIDE alterations)
- The system spontaneously detected an unexpected file creation (`/home/admin/.hermes`)

---

## 4. The 4 remaining points and their solutions

| # | Point | Solution(s) | Status |
|---|---|---|---|
| 1 | `leanConstruction` ran as root in its container | Re-deployment via regenerated compose (up-to-date image, entrypoint drop → uid 10000 like the 3 others), data preserved | ✅ Done on 01/09 |
| 2 | Non-existent backups | **A**: server cron 4:30am → `/var/backups/vps-fleet/` (tar.gz 1.3 GB, 7-day retention) · **B**: local script `vps-backup-pull.sh` + Windows scheduled task (automatic pull) · **C (2nd step)**: Synology NAS (the NAS pulls over SSH) | ✅ A+B done on 01/09, C documented |
| 3 | Dependence on the public IP (SSH allowlist, Syncthing 22000) | **Tailscale**: server enrolled ($TAILSCALE_IP); port 22000 **closed for good in UFW**; SSH access possible even if the IP changes | ✅ Done on 01/09 |
| 4 | SSH keys = the most precious secret | Passphrase on `$VPS_SSH_KEY` (in the password manager) + `vps` command (auto agent on fixed socket) + encrypted GPG archive on USB (`backup-keys.sh`) | ✅ Done on 01/09 (left: USB copy) |

---

## 5. Your daily ritual (30 seconds)

1. Open a WSL terminal → type **`vps`** → passphrase **once** → "✅ VPS reachable"
2. Launch opencode from that terminal → everything works (agent connections, skills, backups)
3. The VPS will notify you on Telegram: unusual login, altered file, (and the backup cron runs on its own at 4:30am)

## 6. Reminder: a server is never "secure"

It is **less attackable and monitored**. The real remaining shields:
- **The backups** (made + pulled — the ability to restore is worth more than any hardening)
- **Your private keys** (passphrase in the manager, GPG archive on USB)
- Vigilance: any unusual Telegram alert = to look at, not to ignore.

---

## 7. User-side Procedures (to do once)

### 7.1 GPG archive of keys → USB key
```bash
bash ~/dev/VPS/Installation/scripts/backup-keys.sh    # GPG passphrase = the one of your SSH key
```
Then: copy `~/backups/keys/*.gpg` to **a USB key** and note the passphrase in the password manager. Restoration documented in the script output.

### 7.2 Windows Scheduled Task (automatic backup pull)
In **Windows** (CMD or PowerShell):
```
schtasks /Create /TN "VPS Backup Pull" /TR "wsl.exe -e bash /home/redouane/dev/VPS/Installation/scripts/vps-backup-pull.sh" /SC DAILY /ST 11:00
```
The script uses the **dedicated** key `$VPS_KEY_BACKUP` (no passphrase but locked server-side: `restrict` + forced command = stream only the latest archive). It can do nothing else, even if stolen. Check: `~/backups/vps-fleet/fleet-latest.tar.gz`.

### 7.3 Tailscale on your devices
1. Install the app (PC: https://tailscale.com/download ; mobile: store) → login **REDACTED_EMAIL**
2. The server is already enrolled: **$TAILSCALE_IP**
3. The future Syncthing sync will go through this IP (the public port 22000 is closed)

### 7.4 Synology NAS (2nd step — the NAS pulls, not the VPS)
1. DSM → Control Panel → Terminal & SNMP → enable SSH
2. On the NAS: `ssh-keygen -t ed25519 -f /volume1/backups/.ssh/$VPS_SSH_KEY -N ""` → copy the `.pub` into `/home/admin/.ssh/authorized_keys` on the VPS (with `restrict,command=` like `$VPS_KEY_BACKUP` if we want to restrict, or as an rsync read key)
3. DSM → Task Scheduler → scheduled task (root) → script: `rsync -az --delete -e "ssh -i /volume1/backups/.ssh/$VPS_SSH_KEY -p $VPS_SSH_PORT" admin@$VPS_IP:/var/backups/vps-fleet/ /volume1/backups/nemo/`

### 7.5 Local hygiene (outside the VPS) — TO DO in a dedicated session
Your **local** `.bashrc` still contains secrets in plaintext (RUNPOD, HF, Supabase, tokens…). The VPS is hardened, but your PC remains the treasure. Procedure (same pattern as the VPS, ~20 min):

```bash
# 1. Backup
cp -a ~/.bashrc ~/.bashrc.preaudit-$(date +%Y%m%d)
# 2. Secure folder + extraction of ALL export lines
mkdir -p ~/.config/secrets && chmod 700 ~/.config/secrets
umask 077
grep -E '^export [A-Za-z_][A-Za-z_0-9]*=' ~/.bashrc > ~/.config/secrets/env
# 3. Syntax check + sourcing under set -u
bash -n ~/.config/secrets/env && bash -uc '. ~/.config/secrets/env && echo OK'
# 4. Remove the exports from .bashrc + keep the sourcing
sed -i '/^export [A-Za-z_][A-Za-z_0-9]*=/d' ~/.bashrc
printf '\n# Local secrets (never commit)\n[ -f ~/.config/secrets/env ] && . ~/.config/secrets/env\n' >> ~/.bashrc
chmod 600 ~/.bashrc ~/.config/secrets/env
# 5. Test a NEW terminal (variables loaded) before closing the old one
```

### 7.6 PAM SSH hook — Telegram alert on unauthorized IP

A PAM hook (`/usr/local/bin/telegram-alert-ssh.sh`) sends a Telegram alert ("Louky") on every SSH login from a **non-whitelisted** IP.

**Whitelist**: variable `SSH_ALERT_ALLOWED_IPS` in `/etc/secrets/hermes.env` (600, root).
```bash
# View
sudo grep SSH_ALERT_ALLOWED_IPS /etc/secrets/hermes.env
# Result: export SSH_ALERT_ALLOWED_IPS="$SOURCE_IP $SOURCE_IP_2"

# Update (dynamic SFR IP — to redo if you change IP)
sudo sed -i 's/SSH_ALERT_ALLOWED_IPS=.*/SSH_ALERT_ALLOWED_IPS="OLD NEW"/' /etc/secrets/hermes.env
```

**How to know if your IP changed**: you receive "SSH Connection - Unauthorized IP" notifications while it is you who is connecting. The IP displayed in the notification is the right one — add it to the whitelist.

**Note**: this hook is **independent** of the Contabo firewall (WebExposure) and UFW. It is monitoring internal to the VPS.

Additions: BitLocker enabled on the Windows disk (Control Panel → Drive Encryption), 2FA on Telegram + Google + GitHub, Kaspersky kept + automatic Windows updates.
