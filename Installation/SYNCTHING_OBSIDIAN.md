# Syncthing & Obsidian — Operations Guide (Contabo VPS)

**Server**: `$VPS_HOSTNAME` — Ubuntu 22.04 LTS — IP `$VPS_IP`
**Last updated**: 30/08/2026

---

## 1. Architecture

### 1.1 Syncthing Devices

| Device | Name | Device ID | Role | Status |
|---|---|---|---|---|
| **VPS** | `$VPS_HOSTNAME` | `$SYNCTHING_DEVICE_ID | Server | ✅ |
| **PC** (Windows/WSL) | `$DESKTOP_DEVICE` | `GPMPYZ2-7JRJHKB-KYUMBCW-HULB5EG-HRQXCCU-FP5VEZT-UNUGXUM-54LFAQE` | Client | ✅ connected (relay) |
| **Mobile** (Android) | `Android-Mobile` | `67QMEVF-UF4DO7C-3BWARCW-OYJKEDH-FYZ2BX7-P32OXQS-ZCNA2OM-MBZM2QX` | Client | ⚠️ declared, connection to be confirmed |

### 1.2 Shared folder

| Parameter | Value |
|---|---|
| Folder ID | `obsidian-vault` |
| Label | `Obsidian Vault` |
| VPS path | `/home/syncthing/obsidian-vault` |
| Type | `sendreceive` |
| Size | ~612 MB — 15,342 files |
| State | 100% synchronized (`inSync 599 032 479 bytes`, `needFiles: 0`) |
| Shared devices | $VPS_HOSTNAME + $DESKTOP_DEVICE + Android-Mobile |

### 1.3 Consumers (Hermes Docker agents)

The 4 Docker agents mount the vault read-only in the container (`/opt/vault`):
`hermes-leanConstruction`, `hermes-copycat`, `hermes-aquisition`, `hermes-va_agent`
→ mount `- /home/syncthing/obsidian-vault:/opt/vault`

---

## 2. Connections & Access

### 2.1 SSH (port $VPS_SSH_PORT)

```bash
ssh nemo            # admin@$VPS_IP:$VPS_SSH_PORT — key ~/.ssh/$VPS_SSH_KEY (no passphrase)
```

Config `~/.ssh/config`:
```
Host nemo
    HostName $VPS_IP
    User admin
    Port $VPS_SSH_PORT
    IdentityFile ~/.ssh/$VPS_SSH_KEY
    IdentitiesOnly yes
```

> **History**: the old `nemo` alias in the `.bashrc` pointed to `root@22` (blocked by the hardening) and overrode the SSH config — it was commented out.

### 2.2 VPS Syncthing GUI (SSH tunnel)

The GUI listens on `127.0.0.1:8384` (localhost only). **Never publicly exposed** — access via SSH tunnel:

```bash
syncthing-gui      # alias = ssh -N -L 8384:127.0.0.1:8384 nemo
```

Then open: **http://localhost:8384** (VPS GUI, device `$VPS_HOSTNAME`).

Stopping the tunnel: `Ctrl+C`.

**SSH prerequisite**: `AllowTcpForwarding local` enabled on the VPS side (`/etc/ssh/sshd_config.d/10-tunnel.conf`). Allows `ssh -L` but blocks `-R`/`-D`.

---

## 3. System Configuration

### 3.1 Service

```bash
systemctl status syncthing@syncthing.service    # active + enabled (boot)
systemctl restart syncthing@syncthing.service   # restart
```

### 3.2 UFW Firewall

```
22000/tcp   ALLOW   $SOURCE_IP    # Syncthing — restricted to the PC IP (WSL)
$VPS_SSH_PORT/tcp    ALLOW   Anywhere        # hardened SSH
```

> **Warning**: if the PC (WSL) public IP changes, update the rule:
> ```bash
> sudo ufw delete allow from $SOURCE_IP to any port 22000 proto tcp
> sudo ufw allow from <NEW_IP> to any port 22000 proto tcp
> ```

### 3.3 Global relaying (nomads)

`relaysEnabled: true` + `listenAddress: default` + global announcements active.
→ Mobile devices (4G/5G) sync **via relay** without opening a fixed IP in UFW.
The PC currently connects via `relay-server 80.231.63.246:443`.

### 3.4 Syncthing Listening Ports

| Port | Interface | Usage |
|---|---|---|
| 8384/tcp | 127.0.0.1 | Web GUI |
| 22000/tcp | * (all) | Data transfer (filtered by UFW) |
| 21027/udp | * | Local discovery |

---

## 4. Procedures

### 4.1 Access the VPS GUI

```bash
syncthing-gui     # then browser → http://localhost:8384
```

### 4.2 Restart Syncthing

```bash
ssh nemo
sudo systemctl restart syncthing@syncthing.service
```

### 4.3 Add a new device

1. From the device: copy its Device ID (Actions → Show ID / Settings → Device).
2. On the VPS (GUI via tunnel, or REST API): add the device.
3. From the device: add the VPS Device ID `$SYNCTHING_DEVICE_ID (two-way pairing mandatory).
4. Share the `obsidian-vault` folder (same Folder ID on both sides).
5. If a direct connection is desired: open `22000/tcp` for the device's IP in UFW (otherwise the relay handles it).

### 4.4 Quick diagnostics (via GUI tunnel or API)

```bash
# Folder state
curl -s -H "X-API-Key: <apikey>" "http://127.0.0.1:8384/rest/db/status?folder=obsidian-vault"

# Device connections
curl -s -H "X-API-Key: <apikey>" "http://127.0.0.1:8384/rest/system/connections"
```

The API key is in `/home/syncthing/.config/syncthing/config.xml` (`<gui>` block).

---

## 5. Troubleshooting

### 5.1 Android not connected

- Check the **two-way pairing**: the VPS device must be added in the Android app.
- Check that the `obsidian-vault` **folder** is shared with the mobile.
- **Relay on the Android side**: enable "Use relays" in the device settings.
- Check Android **battery/optimization** (do not kill Syncthing in the background).
- If needed: open `22000/tcp` for the mobile's IP in UFW.

### 5.2 PC (WSL) IP changes

Update the UFW rule (see §3.2). Durable alternative: switch the PC to relay (like the mobile).

### 5.3 Sync conflicts

- Conflicts are kept by Syncthing (`*.sync-conflict-*`) in the vault.
- To ignore certain folders (caches, temp): create a `.stignore` file at the vault root (to do on ALL devices, since it syncs).

### 5.4 GUI responds but blank page

- Check that the tunnel is active (port 8384 listening locally).
- Test `curl -o /dev/null -w "%{http_code}" http://localhost:8384/` → must return 200.

---

## 6. Backup (recommendations)

**Lesson learned**: the original `backup.tar.gz` backup did NOT include `/home/admin/hermes-fleet/` → loss of the Docker agents' histories. From now on, include:

| Path | Content |
|---|---|
| `/home/syncthing/obsidian-vault/` | Obsidian vault (612 MB) |
| `/home/admin/hermes-fleet/` | Docker agents: sessions, memories, state.db, configs |
| `/home/<runner>/.hermes/` | Native runners: sessions, memories, state.db, .env |
| `/root/.fleet_tokens.env` | Telegram tokens of the Docker agents |
| `/root/.bashrc` | API keys + fleet functions/aliases |
| `/etc/docker/` | hardened `daemon.json` |

---

## 7. Security Reminders

- ✅ Syncthing GUI **never publicly exposed** (SSH tunnel only).
- ✅ Port 22000 **restricted** to the PC IP (WSL).
- ✅ Relay active → no global opening needed for nomads.
- ✅ SSH tunnel limited to `AllowTcpForwarding local` (`-R`/`-D` blocked).
- ⚠️ The **secrets** remain in plaintext in `/root/.bashrc` → to be moved to `/etc/secrets/` (recommended).
- ⚠️ If the WSL IP changes, update the UFW 22000 rule.

---

## 8. Quick Reference — Identifiers

```
VPS  ($VPS_HOSTNAME)  : $SYNCTHING_DEVICE_ID
PC   ($DESKTOP_DEVICE) : GPMPYZ2-7JRJHKB-KYUMBCW-HULB5EG-HRQXCCU-FP5VEZT-UNUGXUM-54LFAQE
Mobile (Android)    : 67QMEVF-UF4DO7C-3BWARCW-OYJKEDH-FYZ2BX7-P32OXQS-ZCNA2OM-MBZM2QX
Folder              : obsidian-vault  →  /home/syncthing/obsidian-vault
SSH                 : ssh nemo  (admin@$VPS_IP:$VPS_SSH_PORT)
GUI VPS             : syncthing-gui  →  http://localhost:8384
```
