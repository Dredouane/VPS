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
├── HermesCapabilities/        ← 🧩 Compétences modulaires (email, OCR, RAG…)
│   ├── README.md              ← Cycle de vie d'une capability
│   ├── ARCHITECTURE.md        ← Contrat manifest + matrice natif/mix/sidecar
│   ├── capabilities/          ← TEMPLATE + pilote rag-supabase (C5)
│   ├── pipelines/             ← Compositions de capabilities (chaînes métier)
│   └── scripts/               ← capability-test.sh + capability-attach.sh
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

## 🛡️ Skills de non-régression

6 skills OpenCode (`.opencode/skills/`) vérifient en **lecture seule** que
l'état validé (audit du 30/08/2026) ne régresse pas. Les invoquer par leur
nom ou par mots-clés (ex. « lance vps-check-full ») — **redémarrer opencode**
après leur création pour les charger :

| Skill | Périmètre |
|---|---|
| `vps-check-repo` | Repo git local : secrets versionnés, `.gitignore`, `~/.ssh/config`, alias |
| `vps-check-securite` | Hardening VPS : sshd 2222 + ciphers, UFW/DOCKER-USER, Fail2ban, AIDE, sysctl, `/etc/secrets` 600, hook PAM |
| `vps-check-flotte` | Flotte legacy : 4 conteneurs 8650-8653, 2 runners natifs, loukyrunner inactif, 0 conflit 409, `spawn-hermes.sh` |
| `check-hermesconfig` | Invariants HermesConfig : template compose, `audit-hermes-pro.sh`, `redact_secrets`, ACLs Obsidian, drift repo↔VPS |
| `vps-check-sync` | Syncthing : service actif, folder idle, GUI 127.0.0.1:8384, vault `VPS/HermesConfig` |
| `vps-check-full` | Orchestrateur : exécute les 5 skills (repo → sécurité → flotte → HermesConfig → sync) + synthèse PASS/FAIL |

Format : tableau `✓ PASS / ✗ FAIL / ~ WARN` + renvoi exact vers la doc de
remédiation — les skills **ne corrigent jamais** (rapport seul).
Registre des invariants HermesConfig : [`HermesConfig/VERIFICATIONS.md`](HermesConfig/VERIFICATIONS.md).

## 🔗 Liens utiles

- [Repo GitHub](https://github.com/Dredouane/VPS)
- Vault Obsidian local → voir [`Obsidian_Vault.md`](Obsidian_Vault.md)
