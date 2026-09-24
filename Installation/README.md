# 📦 Installation — VPS technical documentation

This folder contains all the technical documentation and scripts related to the **setup, securing and operation** of the Contabo VPS.

## Contents

| File | Description |
|---|---|
| `VPS_HARDENING_PLAN_FINAL.md` | Complete hardening plan for the VPS (13 sections) — the source-of-truth hardening document |
| `DOCUMENTATION_VPS.md` | Overall post-installation documentation: access, users, security, Hermes agent fleet, TO DO |
| `SYNCTHING_OBSIDIAN.md` | Syncthing & Obsidian operations guide: devices, folder, SSH tunnel, backup |
| `RAPPORT_AUDIT_2026-08-30.md` | Security audit report (verified checkpoints, dynamic tests) |
| `spawn-hermes.sh` | Deployment script for Dockerized Hermes agents (fleet) |

## Context

- **Server**: `$VPS_HOSTNAME` — Ubuntu 22.04 LTS — `$VPS_IP`
- **SSH access**: `ssh nemo` (admin@$VPS_SSH_PORT, key `$VPS_SSH_KEY`)
- **GitHub repo**: [Dredouane/VPS](https://github.com/Dredouane/VPS) (private)

> The values above (`$VPS_*`, `$SOURCE_IP`…) are mere environment
> variables loaded automatically from the "VPS infrastructure identity" block
> of your `~/.bashrc` — see
> [`LOCAL_SETUP.md`](../LOCAL_SETUP.md). Copy-pasting the commands in this
> folder works as-is in a terminal where these variables are defined.

## Recommended reading order

1. `VPS_HARDENING_PLAN_FINAL.md` — understand the applied hardening
2. `DOCUMENTATION_VPS.md` — final state of the system
3. `SYNCTHING_OBSIDIAN.md` — vault sync management
4. `RAPPORT_AUDIT_2026-08-30.md` — verified security guarantees

## Scripts

The file `spawn-hermes.sh` is the reference script for deploying a Dockerized Hermes agent:
```bash
# On the VPS (as root):
cd /home/admin/hermes-fleet
./spawn-hermes.sh <agent_name> "<telegram_bot_token>"
```
