# 🗂️ Obsidian Vault — Dedicated folder for the VPS project

## 📍 Location of the project's Obsidian folder

The Obsidian vault is hosted on the **VPS** and synchronized via **Syncthing** between devices.

| Item | Value |
|---|---|
| **Main vault (VPS)** | `/home/syncthing/obsidian-vault/` |
| **Sub-folder dedicated to the VPS project** | `/home/syncthing/obsidian-vault/VPS/` **(to be created)** |
| Syncthing folder | `obsidian-vault` (sendreceive, synced VPS + PC + Mobile) |
| Syncthing GUI access | `syncthing-gui` → http://localhost:8384 |

## 🗃️ Vault structure

```
/home/syncthing/obsidian-vault/
├── Aquisition/
├── CopyCat/
├── LeanConstruction/
├── VirtualAdministrativeAssistant/
├── lean-cognitive-atlas/
├── VPS/                     ← 📌 FOLDER DEDICATED TO THIS PROJECT (to be created)
├── PAIN-002.md
└── ...
```

## ✅ Create the `VPS` sub-folder in the vault

**On the VPS** (via `ssh nemo`):

```bash
sudo mkdir -p /home/syncthing/obsidian-vault/VPS
sudo chown syncthing:syncthing /home/syncthing/obsidian-vault/VPS
```

The folder will sync automatically to the PC and mobile via Syncthing.

> 💡 **Alternative (recommended)**: create the `VPS/` folder **from Obsidian** (PC or mobile). It will then appear in the vault at the next sync, and you can drop your project notes into it directly from the application.

## 📝 Expected notes in this folder

- VPS operations notes and technical decisions
- Hermes agent fleet status
- Task tracking (hardening, Syncthing, nginx, backups)
- Reference copy of the `Installation/` documents if needed (as notes)

## 🔗 Reference

Full technical documentation: [`Installation/SYNCTHING_OBSIDIAN.md`](Installation/SYNCTHING_OBSIDIAN.md)
