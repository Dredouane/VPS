---
name: vps-check-sync
description: >-
  Syncthing & Obsidian vault non-regression on the nemo VPS (SSH read-only):
  service syncthing@syncthing active, obsidian-vault folder in idle state,
  GUI bound to 127.0.0.1:8384, VPS/HermesConfig project sub-folder,
  device connections, relays, port 22000. Use when the user says "check
  sync", "vps-check-sync", "Syncthing", "vault Obsidian", "synchronisation",
  "état du sync", or as part of vps-check-full.
---

# Sync check — Syncthing & Obsidian vault (SSH read-only)

**Read-only** audit of Syncthing on `nemo` (admin@$VPS_IP:$VPS_SSH_PORT,
key `$VPS_SSH_KEY`), baseline = `Installation/SYNCTHING_OBSIDIAN.md`.
Absolute rules:

1. **Strict READ-ONLY**: forbidden server-side — `systemctl restart`,
   `syncthing` (CLI), `rm`, `sed -i`, any config write. The skill
   reports, it never fixes.
2. **No secret displayed**: the **GUI apikey** (read from `config.xml`) and
   the **full device IDs** must NEVER appear in the output nor
   in an echoed command — extract them into a variable server-side,
   display only the states (`idle`, `needFiles`, counters) and masked
   prefixes (`GPMPYZ2-…`, `67QMEVF-…`).
3. Output: table `| Check | Statut | Detail |` with `✓ PASS` / `✗ FAIL` /
   `~ WARN` / `⏭ SKIP` + global verdict (SAIN / ACTION REQUISE).
4. FAIL → point to the remediation (§Remediation), apply nothing.

## Connection

```bash
SSH="ssh -o BatchMode=yes -o ConnectTimeout=8 nemo"
```

Preliminary probe: `$SSH 'echo ok'` → if it fails: **all checks Y1-Y8 =
SKIP**, conclude with the note "VPS unreachable — remote checks skipped".
Check Y9 is local (runnable no matter what).

## Checks

| # | Check | Command (`$SSH '…'`) | Expected |
|---|---|---|---|
| Y1 | Service active + enabled | `systemctl is-active syncthing@syncthing` + `systemctl is-enabled syncthing@syncthing` | `active` + `enabled` |
| Y2 | `obsidian-vault` folder | `APIKEY=$(sudo grep -oP '(?<=<apikey>)[^<]+' /home/syncthing/.config/syncthing/config.xml); curl -s -H "X-API-Key: $APIKEY" 'http://127.0.0.1:8384/rest/db/status?folder=obsidian-vault' \| grep -oE '"(state\|needFiles\|needBytes)":[^,}]*'` | `state: idle`, `needFiles: 0` |
| Y3 | Devices | `curl … /rest/system/connections` → list `id[:7]-…` + `connected=` (python, masked IDs) | 4 declared devices: PC (`GPMPYZ2-…`) connected + a 2nd active device (`6QXB532-…`); Android (`67QMEVF-…`) and `$SYNCTHING_DEVICE_ID offline = `~ WARN` (mobile not always on) |
| Y4 | GUI local only | `sudo grep -A3 '<gui' /home/syncthing/.config/syncthing/config.xml \| grep -oE '<address>[^<]+</address>'` | `127.0.0.1:8384` — **FAIL if `0.0.0.0`** |
| Y5 | Relays enabled | `sudo grep -oE '<relaysEnabled>[a-z]*</relaysEnabled>' /home/syncthing/.config/syncthing/config.xml` | `<relaysEnabled>true</relaysEnabled>` (nomads via relay) |
| Y6 | Project sub-folder | `sudo stat -c '%U:%G %a' /home/syncthing/obsidian-vault/VPS` (sudo mandatory) | exists, owner `syncthing:syncthing` |
| Y7 | HermesConfig vault | `ls /home/syncthing/obsidian-vault/VPS/HermesConfig/` | notes present (VEILLE, Décisions, Runbook AREV, État flotte pro) + `arev/` sub-folder |
| Y8 | Data port 22000 | `sudo ss -tlnp \| grep syncthing` | `*:22000` listening (process) — **UFW closes the port since 01/09** (no ALLOW rule, see `vps-check-securite` skill S14); future sync will go through Tailscale (`$TAILSCALE_IP`) |
| Y9 | GUI tunnel (local) | `grep syncthing-gui ~/.bashrc` (local machine) | alias present — see `vps-check-repo` skill R9 |

⚠️ Y2/Y3: never `echo $APIKEY` nor log the command with the key;
run the extraction and the curl **in the same SSH session**.

## Report

1. Final table `| Check | Statut | Detail |` (Syncthing states, GUI/security,
   vault).
2. If `state` ≠ `idle` (e.g. `scanning`, `syncing`): `~ WARN` if
   transient (re-check once), FAIL if persistent + needFiles > 0.
3. Global verdict: **SAIN** if 0 FAIL, otherwise **ACTION REQUISE**.
4. Reminder: report regressions, fix nothing.

## Remediation (on FAIL)

| Check | Reference |
|---|---|
| Y1 (service) | `Installation/SYNCTHING_OBSIDIAN.md` §3.1 (Service) + §4.2 (Restart Syncthing) |
| Y2-Y3 (folder/devices) | `Installation/SYNCTHING_OBSIDIAN.md` §4.4 (Quick diagnostics) + §5 (Troubleshooting: Android not connected, changing WSL IP, conflicts) |
| Y4-Y5 (GUI/relays) | `Installation/SYNCTHING_OBSIDIAN.md` §7 (Security reminders) + §3.3 (Relays) |
| Y6-Y7 (vault) | `Installation/SYNCTHING_OBSIDIAN.md` §1.2 (Shared folder) + `Installation/DOCUMENTATION_VPS.md` §4.6 (Obsidian Vault & Syncthing) |
| Y8 (port 22000) | `Installation/SYNCTHING_OBSIDIAN.md` §3.2 (UFW firewall) + §3.4 (Listening ports) |
| Y9 (alias) | `Installation/DOCUMENTATION_VPS.md` §1 (SSH access) |
