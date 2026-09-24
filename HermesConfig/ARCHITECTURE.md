# 🏗️ Architecture HermesConfig — Décisions (ADR)

Statuts : ✅ accepté · 🔄 révisable. Date : 30/08/2026. Contexte : VPS Contabo
`$VPS_HOSTNAME` (Ubuntu 22.04 durci — UFW, Fail2ban, AIDE, secrets dans
`/etc/secrets/`), flotte Hermes existante (4 Docker + 2 natifs).

---

## D1 — Mode de déploiement : Docker fleet v2 ✅

**Décision** : un conteneur par agent client, orchestré par
`spawn-hermes-pro.sh`, à partir de `docker/docker-compose.yml.template`.

**Justification** :
- Cohérence avec la flotte existante (`/home/admin/hermes-fleet/`).
- Isolation forte (critique après l'incident rootkit historique).
- Reproductibilité et version pinning clairs.
- Volumes (SQLite, `.hermes`, vault) parfaitement gérables sans userns-remap.

**Alternative documentée (mode natif systemd)** : comme `arev-chantier-runner`
— utilisateur dédié sans sudo, service `hermes-gateway-<slug>.service`
(`Restart=always`, `enabled`), binaire `/usr/local/bin/hermes`, `~/.hermes/`
comme home. À réserver aux cas où Docker n'est pas souhaitable ; le sous-projet
et le spawn script sont **orientés Docker en premier**.

## D2 — Client variabilisé ✅

**Décision** : le client est un **slug** (`arev`, `monclient`…). Tout dérive de
`clients/<slug>/` : `client.env` (secrets + config), `soul.md` (contrat).
Un nouveau client = `cp -r clients/TEMPLATE clients/<slug>` + remplir les
variables + `spawn-hermes-pro.sh <slug>`. **Aucune modification de code.**

## D3 — Secrets : jamais dans les YAML, CLI ou git ✅

- `clients/<slug>/client.env` (mode 600) référencé par `env_file:` dans le
  compose généré — les secrets n'apparaissent **jamais** en clair dans le YAML.
- Clés globales (DeepSeek…) : `/etc/secrets/hermes.env` côté host si besoin.
- `.gitignore` du repo couvre `*.env`. Les `.env.example` contiennent des
  placeholders vides uniquement.
- `security.redact_secrets: true` activé dans la config runtime.

## D4 — Réseau : loopback only ✅

`ports: - "127.0.0.1:<port>:8642"` — l'API gateway n'est joignable que depuis
le host (SSH tunnel). UFW `deny 864x` reste en défense en profondeur. Pas
d'exposition publique, contrairement à la flotte v1 (`0.0.0.0` + UFW seul).

## D5 — Runtime conteneur : flux officiel gosu, caps minimales ✅

Vérifié dans l'image (`hermes-repo` Dockerfile + `docker/entrypoint.sh`) :
- L'utilisateur image `hermes` = **UID 10000** (`useradd -u 10000`).
- L'entrypoint, lancé root : remap optionnel `HERMES_UID`/`HERMES_GID`, fix
  ownership du data-dir + `.venv`, `config.yaml` en 640, puis **gosu → hermes**.
  Le process gateway ne tourne **jamais en root** après le drop.

**Choix** : ne PAS forcer `user:` dans le compose (casserait la logique
entrypoint/`.venv`) ; à la place :
- `HERMES_UID=10000`, `HERMES_GID=10000` explicites,
- data-dir pré-créé par le spawn : `chown 10000:10000`, `chmod 700`,
- `security_opt: [no-new-privileges:true]` (gosu = drop de privilèges, compatible),
- `cap_drop: [ALL]` + `cap_add: [CHOWN, FOWNER, SETUID, SETGID, DAC_OVERRIDE]`
  (le minimum requis par usermod/chown/gosu dans la phase root de l'entrypoint),
- `read_only: false` (Hermes écrit caches/sessions dans `HERMES_HOME` et
  `/opt/hermes/.venv` — pas de `read_only: true` sans qualification approfondie).

## D6 — Vault Obsidian : mounts scopés par client ✅

- ❌ Ne jamais monter `/home/syncthing/obsidian-vault` entier (fuite croisée
  entre clients).
- ✅ Mount unique : `/home/syncthing/obsidian-vault/VPS/HermesConfig/<slug>/`
  → `/opt/vault` (rw restreint au périmètre client).
- Droits : dossier possédé par `10000:10000` (l'agent), ACL `u:syncthing:rwx`
  (défaut inclus) pour préserver la synchro Syncthing. Fallback `chown` si
  `setfacl` indisponible.
- `HERMES_VAULT_DIR=/opt/vault` côté conteneur.

## D7 — Bot Mode : mesuré, rôles serveur ✅

- 2-4 rôles stables **max** par client (voir `hermes/bots/README.md`).
- Règle Bot vs Subagent (veille §3.1) : récurrent + mémoire propre + capacités
  propres + appelable par rôle → **Bot** ; sinon subagent temporaire.
- Bot Ops (avec routines cron) en premier ; Desktop nécessaire pour les group
  chats, mais les profiles/routines fonctionnent headless Docker.

## D8 — Image pinnée ✅

- Tag explicite (`hermes-agent:vYYYY.M.D-<rev>`), **jamais `latest`** dans les
  compose générés.
- Le spawn script vérifie la présence de l'image taggée (la crée depuis
  `hermes-repo` si absente, ou retagge l'image buildée du jour après validation
  humaine).
- Procédure de mise à jour : `git -C hermes-repo pull` → build → **test sur un
  agent non-critique** → retag → redeploy.

## D9 — Token Telegram : option A (nouveau bot par agent) ✅

- Nouveau bot @BotFather pour chaque agent pro → zéro conflit polling 409,
  migration douce, le runner natif existant (`arev-chantier-runner`,
  @Arev_Chantiers_AssistBot) peut rester en parallèle pendant les tests.
- Option B (réutiliser le token existant) exige d'arrêter le runner natif
  **avant** le spawn — documenté dans DEPLOYMENT.md comme chemin de cutover.

## D10 — Observabilité & robustesse ✅

- `healthcheck` compose : `gateway_state.json` (`"state":"connected"`) —
  source de vérité (l'API 8642 ne tourne pas en gateway headless),
  `start_period` 90 s (premier boot = bootstrap config + login Telegram).
- ⚠️ **Leçon (30/08/2026)** : ne pas définir `TELEGRAM_FALLBACK_IPS` — le TLS
  direct vers l'IP brute échoue la vérification de certificat sur les builds
  récents → « connect timed out ». Connexion directe à `api.telegram.org` : OK.
- `restart: unless-stopped`, logs Docker plafonnés (`10m`, 3 fichiers).
- `mem_limit` / `cpus` par conteneur (multi-tenant : un agent fou ne peut pas
  affamer le VPS).
- `audit-hermes-pro.sh` : audit read-only (santé, ports, perms, fuite de
  secrets, état Telegram, ressources).
- Sauvegardes : `/home/admin/hermes-fleet/HermesConfig/instances/<slug>/data/`
  + `clients/` à intégrer à la procédure de backup du VPS (voir
  `DOCUMENTATION_VPS.md` §6).

## D11 — Routines cron attachées au bot Ops ✅

Les responsabilités récurrentes (backup check, monitoring, rapports) vivent
sur le **bot Ops** du client, pas sur l'agent principal. Outil : `hermes cron`
(headless). Voir `hermes/routines/README.md`.

## D12 — Config runtime pro ✅

`hermes/config.yaml.example` (copié dans le data-dir au spawn) :
- `security.redact_secrets: true`,
- model/provider explicites (DeepSeek par défaut, surchargés par `client.env`),
- dashboard désactivé (`HERMES_DASHBOARD=0`),
- approvals : mode interactif conservé — pas de `--yolo`, pas de `--safe-mode`
  bypass ; voir `hermes/bots/README.md`.
