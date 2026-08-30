# 🖥️ VPS — Documentation de projet

Documentation et scripts du **VPS Contabo** (`REDACTED` — Ubuntu 22.04 LTS, IP `REDACTED`) : durcissement, restauration, flotte d'agents Hermes, Syncthing & Obsidian.

> 🔒 **Repo privé** — ne pas committer de secrets (tokens, clés API, archives de backup).

---

## 📂 Arborescence

```
VPS/
├── README.md                  ← Ce fichier : vue d'ensemble du projet
├── Obsidian_Vault.md          ← Où se trouve le vault Obsidian dédié au projet
│
├── Installation/              ← Documentation technique + scripts d'installation
│   ├── README.md              ← Guide du dossier Installation
│   ├── VPS_HARDENING_PLAN_FINAL.md   ← Plan de blindage (13 sections)
│   ├── DOCUMENTATION_VPS.md          ← Doc globale post-installation
│   ├── SYNCTHING_OBSIDIAN.md         ← Guide Syncthing & Obsidian
│   ├── RAPPORT_AUDIT_2026-08-30.md   ← Rapport d'audit sécurité
│   └── spawn-hermes.sh               ← Script de déploiement des agents Hermes (v1)
│
├── HermesConfig/              ← 🤖 Agents Hermes PRO clients PME (v2, variabilisé)
│   ├── README.md              ← Vue d'ensemble + quickstart
│   ├── VEILLE_HERMES_2026-08.md      ← Veille state of the art (août 2026)
│   ├── ARCHITECTURE.md        ← Décisions (ADR) — Docker v2, secrets, Bot Mode
│   ├── DEPLOYMENT.md          ← Guide pas-à-pas déploiement VPS
│   ├── docker/                ← Template compose sécurisé
│   ├── clients/               ← TEMPLATE + clients réels (arev)
│   ├── hermes/                ← config, bots, routines, skills
│   └── scripts/               ← spawn-hermes-pro.sh + audit-hermes-pro.sh
│
├── .gitignore                 ← Exclusions (backup.tar.gz, secrets, logs…)
│
└── (non versionnés, locaux uniquement)
    ├── backup.tar.gz          ← Archive de sauvegarde (2,1 Go) — IGNORÉE
    └── spawn-agent.sh         ← Ancien script (lien invalide) — non commité
```

## 🚀 Accès rapide

```bash
ssh nemo                # admin@REDACTED:2222 (clé REDACTED)
syncthing-gui           # tunnel SSH → GUI Syncthing du VPS (http://localhost:8384)
# Agent pro client (flotte HermesConfig v2) :
cd HermesConfig && ./scripts/spawn-hermes-pro.sh <slug>   # sur le VPS
```

## 🔗 Liens utiles

- [Repo GitHub](https://github.com/Dredouane/VPS)
- Vault Obsidian local → voir [`Obsidian_Vault.md`](Obsidian_Vault.md)
