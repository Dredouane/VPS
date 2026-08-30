# 🤖 HermesConfig — Déploiement pro d'agents Hermes pour clients PME

Sous-projet dédié à l'installation d'agents **Hermes Agent** (Nous Research) en
configuration **professionnelle, variabilisée par client**, sur le VPS durci
(`REDACTED`). Successeur de la flotte historique `spawn-hermes.sh` : même
philosophie Docker, niveau de sécurité et de robustesse supérieur.

> 🔒 **Aucun secret n'est versionné ici.** Les `client.env` réels vivent sur le
> VPS uniquement (`.gitignore` couvre `*.env`). Les `.env.example` sont des
> squelettes avec placeholders.

---

## 🧭 Principes (non négociables)

1. **Least privilege** — caps Docker minimales, UID non-root `10000`, ports liés à `127.0.0.1`.
2. **Zéro secret dans les YAML / CLI / git** — tout passe par `clients/<slug>/client.env` (600).
3. **Image pinnée** — jamais de `latest` dans les compose générés.
4. **Client reprend la main facilement** — `SOUL.md` explicite (sait / peut / refuse / escalade), runbook vault.
5. **Bot Mode mesuré** — 2-4 rôles stables max, pas de multiplication de subagents.
6. **Variabilisation totale** — un nouveau client = copier `clients/TEMPLATE/`, remplir 2-3 variables, `spawn-hermes-pro.sh <slug>`.

## 📂 Structure

```
HermesConfig/
├── README.md                      ← Ce fichier
├── VEILLE_HERMES_2026-08.md       ← Veille techno state of the art (août 2026)
├── ARCHITECTURE.md                ← Décisions d'architecture (ADR)
├── DEPLOYMENT.md                  ← Guide pas-à-pas déploiement VPS
├── docker/
│   └── docker-compose.yml.template← Template sécurisé (placeholders __VAR__)
├── clients/
│   ├── TEMPLATE/                  ← Squelette à copier pour un nouveau client
│   │   ├── client.env.example
│   │   └── soul.md
│   └── arev/                      ← Client #1 : AREV Travaux (PME travaux/chantier)
├── hermes/
│   ├── config.yaml.example        ← Config runtime pro (redact_secrets, model…)
│   ├── bots/                      ← Bot Mode : règles + exemples (Ops…)
│   ├── routines/                  ← Routines cron par bot
│   └── skills/                    ← Skills custom client
└── scripts/
    ├── spawn-hermes-pro.sh        ← Déploiement d'un client (idempotent)
    └── audit-hermes-pro.sh        ← Audit santé/sécurité flotte pro (read-only)
```

## 🚀 Quickstart (sur le VPS)

```bash
cd /home/admin/hermes-fleet/HermesConfig

# 1. Nouveau client : copier le template
cp -r clients/TEMPLATE clients/monclient
vim clients/monclient/client.env   # token bot, users autorisés, clé LLM
vim clients/monclient/soul.md      # adapter le contrat au client

# 2. Déployer
./scripts/spawn-hermes-pro.sh monclient

# 3. Vérifier
./scripts/audit-hermes-pro.sh
```

## 🔗 Liens

- Veille & sources officielles : [`VEILLE_HERMES_2026-08.md`](VEILLE_HERMES_2026-08.md)
- Décisions d'architecture : [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Procédure de déploiement complète : [`DEPLOYMENT.md`](DEPLOYMENT.md)
- Doc globale VPS : [`../Installation/DOCUMENTATION_VPS.md`](../Installation/DOCUMENTATION_VPS.md)
- Vault Obsidian : `/home/syncthing/obsidian-vault/VPS/HermesConfig/` (notes ADR, runbook, état flotte)
