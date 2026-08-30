# 🗂️ Obsidian Vault — Dossier dédié au projet VPS

## 📍 Emplacement du dossier Obsidian du projet

Le vault Obsidian est hébergé sur le **VPS** et synchronisé via **Syncthing** entre les appareils.

| Élément | Valeur |
|---|---|
| **Vault principal (VPS)** | `/home/syncthing/obsidian-vault/` |
| **Sous-dossier dédié au projet VPS** | `/home/syncthing/obsidian-vault/VPS/` **(à créer)** |
| Folder Syncthing | `obsidian-vault` (sendreceive, synchronisé VPS + PC + Mobile) |
| Accès GUI Syncthing | `syncthing-gui` → http://localhost:8384 |

## 🗃️ Structure du vault

```
/home/syncthing/obsidian-vault/
├── Aquisition/
├── CopyCat/
├── LeanConstruction/
├── VirtualAdministrativeAssistant/
├── lean-cognitive-atlas/
├── VPS/                     ← 📌 DOSSIER DÉDIÉ À CE PROJET (à créer)
├── PAIN-002.md
└── ...
```

## ✅ Créer le sous-dossier `VPS` dans le vault

**Sur le VPS** (via `ssh nemo`) :

```bash
sudo mkdir -p /home/syncthing/obsidian-vault/VPS
sudo chown syncthing:syncthing /home/syncthing/obsidian-vault/VPS
```

Le dossier se synchronisera automatiquement vers le PC et le mobile via Syncthing.

> 💡 **Alternative (recommandée)** : créer le dossier `VPS/` **depuis Obsidian** (PC ou mobile). Il apparaîtra alors dans le vault à la prochaine synchro, et vous pourrez y déposer vos notes de projet directement depuis l'application.

## 📝 Notes attendues dans ce dossier

- Notes d'exploitation et décisions techniques du VPS
- État de la flotte d'agents Hermes
- Suivi des tâches (hardening, Syncthing, nginx, sauvegardes)
- Copie de référence des documents de `Installation/` si besoin (au format notes)

## 🔗 Référence

Documentation technique complète : [`Installation/SYNCTHING_OBSIDIAN.md`](Installation/SYNCTHING_OBSIDIAN.md)
