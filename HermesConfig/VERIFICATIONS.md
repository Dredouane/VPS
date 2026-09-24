# 🔍 VERIFICATIONS.md — Registre des invariants HermesConfig

> Source de vérité des invariants de non-régression du projet VPS.
> Référencé par le skill opencode `check-hermesconfig`
> (`.opencode/skills/check-hermesconfig/SKILL.md`).
> **Règle** : toute nouvelle leçon → mise à jour de ce fichier + du skill
> (+ `audit-hermes-pro.sh` si côté VPS), commités ensemble.

## §1 Invariants — session 30/08/2026 (HermesConfig v2)

| ID | Invariant | Décision | Leçon / date |
|---|---|---|---|
| I1 | Pas de ligne d'env `TELEGRAM_FALLBACK_IPS=` (TLS IP brute → échec certificat) ; le commentaire d'interdiction du template est attendu | — | 30/08 : timeout Telegram au déploiement arev, résolu en retirant la var |
| I2 | Ports `127.0.0.1:` uniquement | D4 | — |
| I3 | Image pinnée, jamais `latest` | D8 | — |
| I4 | Secrets via `env_file: instances/<slug>/secrets.env` (600) — jamais inline, jamais client.env direct | D3 | 30/08 : clé DEEPSEEK héritée de /etc/secrets/ non transmise via client.env direct |
| I5 | `cap_drop: ALL` + `no-new-privileges:true` + caps min | D5 | — |
| I6 | `HERMES_UID/GID=10000`, data-dir `10000:10000 700` | D5 | 30/08 : UID image vérifié (useradd -u 10000, entrypoint gosu) |
| I7 | Vault mount scopé par client, jamais la racine Obsidian | D6 | — |
| I8 | Santé via `gateway_state.json` (`"state":"connected"`) — jamais curl /health | — | 30/08 : API 8642 inactive en gateway headless (listen vide vérifié) |
| I9 | `security.redact_secrets: true` + `HERMES_DASHBOARD=0` | D12 | — |
| I10 | `mem_limit` + `cpus` + logs 10m×3 + `restart: unless-stopped` | D10 | — |
| I11 | Spawn : sourcing `/etc/secrets/hermes.env` (fallback), héritage DEEPSEEK, `umask 077` + secrets.env 600, secrets jamais CLI/YAML | — | 30/08 : SSH non-interactif ne sourçait pas /root/.bashrc |
| I12 | Spawn idempotent (port conservé, compose re-rendu, données conservées) | — | 30/08 : port passé 8654→8655 au re-spawn avant correctif |
| I13 | Vault client dir `10000:10000` + 775 + ACL `u:syncthing:rwx` (+default) ; package `acl` installé | D6 | 30/08 : setfacl absent → sync Syncthing dégradée |
| I14 | `HermesConfig/` VPS = miroir du repo git (modif → repo + rsync) | — | Convention 30/08 |
| I15 | `SOUL.md` obligatoire : sait / peut / refuse / escalade | Leçon @QuentinLecocq_ | — |

## §2 Catalogue des checks (détail des commandes : voir le SKILL.md)

| Partie | Périmètre | Quand l'exécuter |
|---|---|---|
| A. Local | git secrets, .gitignore, structure (17 fichiers), invariants template I1-I10, config example, scripts (syntaxe + ancrages I11-I12), placeholders, contrats soul.md | Avant tout commit HermesConfig ; après toute modif locale |
| B. VPS | audit-hermes-pro.sh (0 FAIL), I1/I4 réels, santé instances, secrets 600 + vars non vides, data-dirs, vault ACL + notes, **drift md5 repo↔VPS (I14)**, transition arev natif | Après déploiement/modif VPS ; périodiquement |
| C. Cohérence | README racine, DOCUMENTATION_VPS §4.5bis, VERIFICATIONS.md, état git | Nouvelle session / avant commit |
| D. Observation | hardening, supervision, flotte v1 (autres sessions) — WARN informatif | Nouvelle session |

## §3 Périmètre des autres sessions (référence — checks D, non bloquants)

- **Hardening** : SSH $VPS_SSH_PORT clé seule (root bloqué), fail2ban jail sshd,
  UFW deny incoming + deny 8642/8650-8653 + 22000 restreint, AIDE (cron 3h,
  base régénérée 30/08 21:34), unattended-upgrades, secrets dans
  `/etc/secrets/hermes.env` (600, dir 700).
- **Supervision (§5.5 audit)** : `/usr/local/bin/telegram-alert.sh` +
  hook PAM sshd (alerte uniquement connexions inhabituelles — allowlist
  `SSH_ALERT_ALLOWED_IPS`) + `aide-check-alert.sh` conditionnel.
- **Flotte v1 (héritage)** : `hermes-leanConstruction` (8650),
  `hermes-copycat` (8651), `hermes-aquisition` (8652), `hermes-va_agent`
  (8653) ; natifs `hermes-gateway-hermesrunner` (@pipou200bot),
  `hermes-gateway-arev` (@Arev_Chantiers_AssistBot). Gérés par
  `spawn-hermes.sh` — **ne pas ajouter de nouveaux clients en v1**.

## §4 Historique

- **2026-08-30** : création du registre (I1-I15) — leçons de la session
  HermesConfig v2 : `TELEGRAM_FALLBACK_IPS` (TLS IP brute), API headless
  8642 inactive (healthcheck → state file), ACL vault (package acl), résolution
  secrets.env (fallback /etc/secrets), drift repo↔VPS (miroir), idempotence
  spawn (port conservé).
