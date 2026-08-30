# 📦 Installation — Documentation technique du VPS

Ce dossier contient toute la documentation technique et les scripts liés à la **mise en place, la sécurisation et l'exploitation** du VPS Contabo.

## Contenu

| Fichier | Description |
|---|---|
| `VPS_HARDENING_PLAN_FINAL.md` | Plan de blindage complet du VPS (13 sections) — le document source de référence du durcissement |
| `DOCUMENTATION_VPS.md` | Documentation globale post-installation : accès, utilisateurs, sécurité, flotte d'agents Hermes, TO DO |
| `SYNCTHING_OBSIDIAN.md` | Guide d'exploitation Syncthing & Obsidian : devices, folder, tunnel SSH, sauvegarde |
| `RAPPORT_AUDIT_2026-08-30.md` | Rapport d'audit de sécurité (checkpoints vérifiés, tests dynamiques) |
| `spawn-hermes.sh` | Script de déploiement des agents Hermes Dockerisés (flotte) |

## Contexte

- **Serveur** : `REDACTED` — Ubuntu 22.04 LTS — `REDACTED`
- **Accès SSH** : `ssh nemo` (admin@2222, clé `REDACTED`)
- **Repo GitHub** : [Dredouane/VPS](https://github.com/Dredouane/VPS) (privé)

## Ordre de lecture recommandé

1. `VPS_HARDENING_PLAN_FINAL.md` — comprendre le durcissement appliqué
2. `DOCUMENTATION_VPS.md` — état final du système
3. `SYNCTHING_OBSIDIAN.md` — gestion de la synchro du vault
4. `RAPPORT_AUDIT_2026-08-30.md` — garanties de sécurité vérifiées

## Scripts

Le fichier `spawn-hermes.sh` est le script de référence pour déployer un agent Hermes Dockerisé :
```bash
# Sur le VPS (en root) :
cd /home/admin/hermes-fleet
./spawn-hermes.sh <nom_agent> "<telegram_bot_token>"
```
