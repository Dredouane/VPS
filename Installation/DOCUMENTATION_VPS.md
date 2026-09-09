# Documentation Globale — VPS Contabo (Ubuntu 22.04 LTS)

**Hostname** : `REDACTED`
**IP publique** : `REDACTED`
**Contexte** : VPS ré-imaginé chez Contabo puis réinstallé + blindé (reprise depuis zéro), restauration des données depuis `backup.tar.gz`, puis réparation de la flotte d'agents Hermes.

---

## 1. Accès SSH

### Alias configurés dans `~/.ssh/config` (machine locale WSL)

```
Host nemo-root   # connexion root temporaire (PORT 22, mot de passe) — PLUS DISPONIBLE (root bloqué)
Host nemo        # connexion admin (PORT 2222, clé ed25519)   → UTILISER CELUI-CI
```

| Paramètre | Valeur |
|---|---|
| Utilisateur admin | `admin` |
| Port SSH | **2222** |
| Authentification | Clé SSH uniquement (`id_ed25519` + `REDACTED`) |
| `PermitRootLogin` | `no` (root impossible en SSH) |
| `PasswordAuthentication` | `no` |

Commandes :
```bash
ssh nemo            # connexion admin (port 2222)
# En cas de verrouillage SSH : console web Contabo (VNC) en root, mot de passe root.
```

---

## 2. Utilisateurs

| Utilisateur | Rôle | Sudo | Docker |
|---|---|---|---|
| `admin` | Administrateur | ✅ NOPASSWD | ✅ |
| `hermes` | Service (créé par le plan, inutilisé) | ❌ | ❌ |
| `syncthing` | Système (service de sync) | ❌ | ❌ |
| `hermesrunner` | Runner natif Hermes (bot @pipou200bot) | ❌ | ❌ |
| `loukyrunner` | Runner natif (DOUBLON de hermesrunner — même token) | ❌ | ❌ |
| `arev-chantier-runner` | Runner natif Hermes (bot @Arev_Chantiers_AssistBot) | ❌ | ❌ |

**Note** : `loukyrunner` et `hermesrunner` partagent le MÊME token Telegram (@pipou200bot) et la même clé DeepSeek. Un seul des deux peut tourner à la fois (conflit de polling). `hermesrunner` est actif.

**Audit 30/08/2026** : l'utilisateur cloud-init `ubuntu` (uid 1000, shell bash, `authorized_keys` présent + `NOPASSWD:ALL` dans `sudoers.d/90-cloud-init-users` — 2ᵉ porte root-équivalente **non documentée**) a été **supprimé** avec sa règle sudoers. Seul `admin` reste root-équivalent.

---

## 3. Sécurité / Hardening appliqué

| Composant | État |
|---|---|
| SSH durci | Port 2222, clé seule, root bloqué, ciphers/MACs modernes |
| Fail2ban | Jail `sshd` port 2222, banaction ufw, bantime 24h |
| UFW | `deny incoming`, `allow 2222`, règles DOCKER-USER, `deny 8642` |
| Docker | `no-new-privileges`, **pas** d'userns-remap, logs 10m×3 |
| AIDE | Base d'intégrité (sha256), cron quotidien 3h |
| Unattended-upgrades | Actif (patchs sécurité auto) |
| Sysctl | kptr_restrict=2, dmesg_restrict=1, perf_paranoid=3, etc. |
| Postfix | Restreint à localhost (loopback-only) |
| Secrets | `/etc/secrets/hermes.env` (600, dir 700) sourcé par `/root/.bashrc` (600) — migré le 30/08 |
| Utilisateur cloud-init `ubuntu` | Supprimé (R1 audit 30/08) — sudoers `90-cloud-init-users` retiré |
| Cron AIDE | Log daté dynamique `aide-$(date +\%Y\%m\%d).log` (corrigé le 30/08) |
| snapd | Désactivé |
| Supervision Telegram | `/usr/local/bin/telegram-alert.sh` (credentials dans `/etc/secrets/hermes.env`) — hook PAM sshd : alerte **uniquement si connexion inhabituelle** (IP ≠ allowlist `SSH_ALERT_ALLOWED_IPS=REDACTED`, utilisateur ≠ admin, ou locale) + alerte AIDE conditionnelle (cron 3h) — 30/08 |
| AIDE (exclusions churn) | `99_custom` : data-dirs agents, `.hermes` des 3 users, index Syncthing, fail2ban.sqlite3, landscape, vault Obsidian, `/run/containerd` — base régénérée le 30/08 21:34, check 0 diff |

### Ports en écoute publique

| Port | Service | Note |
|---|---|---|
| 2222/tcp | SSH | Autorisé UFW |
| 8642/tcp | API gateway natif hermesrunner | **DENY UFW** (protégé par API_SERVER_KEY) |
| 8650-8653/tcp | Agents Docker (gateways API 8642 des conteneurs) | **DENY UFW** (ports publiés mais bloqués publiquement) |
| 22000/tcp | Syncthing (sync de données) | **FERMÉ (01/09)** — le sync passera par Tailscale (serveur enrôlé : REDACTED) |

### ✅ Secrets migrés vers `/etc/secrets/` (30/08/2026 — audit)

Les secrets autrefois en clair dans `/root/.bashrc` (clés API DeepSeek/Gemini/OpenRouter, tokens Telegram des bots, credentials Google Cloud, identifiants SUREN test) ont été **migrés** vers `/etc/secrets/hermes.env` (600, dir 700, root uniquement). `/root/.bashrc` (600) se termine par :
```bash
[ -f /etc/secrets/hermes.env ] && . /etc/secrets/hermes.env
```
Les scripts exécutés **en shell root interactif** (ex. `spawn-hermes.sh`) chargent donc automatiquement les secrets. Backup pré-migration : `/root/.bashrc.preaudit-20260830`. Règles : ne jamais versionner ce fichier, toujours `chmod 600`.

---

## 4. Flotte d'agents Hermes

### 4.1 Architecture

Deux modes de déploiement :
- **Agents Dockerisés** : un conteneur par agent, image `hermes-agent:latest`, orchestrés par `/home/admin/hermes-fleet/spawn-hermes.sh`
- **Agents natifs** : installation Hermes système (`/usr/local/lib/hermes-agent`, binaire `/usr/local/bin/hermes`), un service systemd par runner

### 4.2 Installation Hermes

| Élément | Emplacement |
|---|---|
| Binaire système | `/usr/local/bin/hermes` (v0.20.6) |
| Code/venv système | `/usr/local/lib/hermes-agent/` (venv Python 3.11) |
| Repo de build Docker | `/home/admin/hermes-fleet/hermes-repo/` |
| Image Docker | `hermes-agent:latest` (5,22 Go, v0.14.0) |
| Script fleet | `/home/admin/hermes-fleet/spawn-hermes.sh` |

### 4.3 Agents DÉPLOYÉS et FONCTIONNELS

| Agent | Mode | Conteneur/Service | Port | Bot Telegram | État |
|---|---|---|---|---|---|
| **leanConstruction** | Docker | `hermes-leanConstruction` | 8650 | @lean_construction_bot | ✅ connecté |
| **copycat** | Docker | `hermes-copycat` | 8651 | @copy_cat_agent_bot | ✅ connecté |
| **aquisition** | Docker | `hermes-aquisition` | 8652 | @aquisition_red_bot | ✅ connecté |
| **va_agent** | Docker | `hermes-va_agent` | 8653 | @red_va_agent_bot | ✅ connecté |
| **hermesrunner** | Natif | `hermes-gateway-hermesrunner.service` | — | @pipou200bot (Louky) | ✅ connecté |
| **arev-chantier-runner** | Natif | `hermes-gateway-arev.service` | — | @Arev_Chantiers_AssistBot | ✅ connecté |

> **Correction importante** : `hermes-leanConstruction` tournait initialement avec le mauvais bot (@suren_construction_bot). Il a été recréé avec son vrai bot **@lean_construction_bot**.

Les tokens des agents Docker sont stockés dans `/root/.fleet_tokens.env` (mode 600).

### 4.4 Services systemd natifs

```bash
systemctl status hermes-gateway-hermesrunner   # bot Louky (@pipou200bot)
systemctl status hermes-gateway-arev           # bot Arev (@Arev_Chantiers_AssistBot)
journalctl -u hermes-gateway-hermesrunner -f
journalctl -u hermes-gateway-arev -f
```

Les deux sont `enabled` (démarrage au boot) et `Restart=always`.

### 4.5 Agents Docker (flotte v1)

> **⚠️ Héritage (v1)** : la flotte historique ci-dessous reste gérée par
> `spawn-hermes.sh`. Les **clients pro PME** sont désormais déployés via le
> sous-projet **`HermesConfig` v2** (sécurisé : secrets hors YAML, ports
> loopback, image pinnée, vault scopé, healthcheck) — voir
> `../HermesConfig/README.md`. Ne pas ajouter de nouveaux clients en v1.

Déployer un nouvel agent dockerisé (v1, héritage) :
```bash
# En tant que root (les secrets DEEPSEEK_API_KEY / TELEGRAM_USER_ID sont dans
# /etc/secrets/hermes.env, sourcé automatiquement par /root/.bashrc — audit 30/08)
cd /home/admin/hermes-fleet
./spawn-hermes.sh <nom_agent> "<telegram_bot_token>"

# Exemple :
./spawn-hermes.sh monAgent "123456789:AA..."
```

Le script : construit l'image si nécessaire (via `hermes-repo`), trouve un port libre (8650+), monte le vault Obsidian (`/home/syncthing/obsidian-vault`), injecte `DEEPSEEK_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS` et lance `hermes gateway run --replace`.

### 4.5bis Flotte PRO HermesConfig (v2) — clients PME

| Agent | Conteneur | Port | Bot Telegram | Image | État |
|---|---|---|---|---|---|
| **arev** (AREV Travaux) | `hermes-arev-pro` | 127.0.0.1:8655 | @ArevLeanyBot (nouveau, option A) | `hermes-agent:v2026.5.16-522` | ✅ connecté (30/08/2026) |

- Déploiement/audit : `/home/admin/hermes-fleet/HermesConfig/scripts/{spawn,audit}-hermes-pro.sh`
- Secrets : `clients/arev/client.env` (600) → résolus dans `instances/arev/secrets.env` (600, référencé par `env_file`) — **jamais dans le YAML ni git**
- Vault **scopé client** : `/home/syncthing/obsidian-vault/VPS/HermesConfig/arev/` → `/opt/vault` (10000:10000 + ACL syncthing)
- Durcissement : `no-new-privileges`, `cap_drop ALL` + caps min, `mem_limit 2g`, `cpus 1.5`, logs 10m×3, healthcheck sur `gateway_state.json`
- Audit 30/08 : **12 OK / 0 FAIL** (`audit-hermes-pro.sh`)
- ⚠️ **Leçon** : ne pas définir `TELEGRAM_FALLBACK_IPS` (TLS direct IP → échec certificat sur builds récents → timeout). Le runner natif `arev-chantier-runner` (@Arev_Chantiers_AssistBot) reste en parallèle pendant la transition.

### 4.5ter HermesCapabilities — volet compétences modulaires (M1, 31/08/2026)

Sous-projet `HermesCapabilities/` : capabilities granulaires (email, OCR, RAG,
analyses…) décrites par contrat `manifest.yaml`, testées unitairement, et
attachables aux instances (`capability-attach.sh`). Ordre de décision
technique : natif > mix > sidecar (matrice dans `ARCHITECTURE.md`). Pilote :
`rag-supabase` (C5, natif — MCP `supabase` du catalogue Hermes). Implémentation
réelle (M2) : schéma/RPC Supabase TEST → wiring MCP sur `hermes-arev-pro`.
Interface future avec le spawn v3 : `integration-hermesconfig.md`.

**Bugs corrigés dans `spawn-hermes.sh`** (vs version d'origine) :
- `entrypoint: []` **supprimé** → l'image utilise son entrypoint natif qui droppe les privilèges vers l'utilisateur `hermes` (sans ça, l'image refuse de lancer le gateway en root)
- Commande : `gateway run --replace` (les options `--no-supervise --force` n'existaient pas)
- L'entrypoint exécute `hermes gateway run --replace` automatiquement
- **Audit 30/08** : `chmod -R 777 "$BASE_DIR/data"` remplacé par `chown -R 10000:10000 … && chmod -R 700 …` (les data-dirs ne sont plus world-writable)

**Correctifs modèle/Provider (plan A — 30/08/2026)** :
- Le `config.yaml` généré au 1er boot forçait `model.default: "anthropic/claude-opus-4.6"` + `provider: auto` → HTTP 400 sur l'endpoint DeepSeek (modèle anthropic invalide).
- **Corrigé** : `cli-config.yaml.example` (dans `hermes-repo`) mis à jour avec `default: "deepseek-chat"` + `provider: "deepseek"`.
- Les config.yaml de aquisition/copycat/va_agent ont été corrigés manuellement + conteneurs redémarrés.
- Le script injecte `HERMES_MODEL=deepseek-chat` + `HERMES_MODEL_PROVIDER=deepseek`.

### 4.6 Vault Obsidian & Syncthing

- Vault : `/home/syncthing/obsidian-vault/` (612 Mo)
- GUI Syncthing : `http://127.0.0.1:8384`
- ⚠️ **Config Syncthing incomplète** : seul le device `REDACTED` (`REDACTED_DEVICE_ID...`) est déclaré, le vault n'a pas de `.stfolder`, aucun device distant → **pas de synchronisation active**. En attente des device IDs des autres appareils.
- UFW : port 22000 restreint à l'IP locale `REDACTED`
- Raccourcis : `sync-status`, `sync-restart`, `sync-reset` (alias dans `/root/.bashrc`)

---

## 5. Rapport d'incident — Agents Hermes ne répondaient pas

### Cause racine
Après la réinstallation, **rien n'était lancé** :
1. Image Docker `hermes-agent:latest` absente
2. Binaire natif `hermes` manquant (`/usr/local/bin/hermes` = lien cassé)
3. Aucun service de gateway actif

### Corrections apportées
1. Build de l'image Docker depuis `hermes-repo` (repo complet retrouvé chez `arev-chantier-runner/.hermes/hermes-agent`)
2. Récupération de `docker/entrypoint.sh` depuis git (fichier absent du working tree)
3. Installation système Hermes v0.20.6 via l'installeur officiel (+ `libatomic1`, + `python-telegram-bot==22.8`)
4. Création de 2 services systemd dédiés + liens `.local/bin/hermes` pour les runners
5. Correction de `spawn-hermes.sh` + déploiement de leanConstruction (Docker)
6. Réinitialisation du `kanban.db` corrompu de arev-chantier-runner

---

## 6. TO DO — Reste à faire

### Agents / Flotte
- [x] **aquisition_bot** : déployé (token fourni) → `hermes-aquisition` port 8652, @aquisition_red_bot ✅
- [x] **copycat** : déployé → `hermes-copycat` port 8651, @copy_cat_agent_bot ✅
- [x] **va_agent** : déployé → `hermes-va_agent` port 8653, @red_va_agent_bot ✅
- [x] **leanConstruction** : recréé avec le bon bot @lean_construction_bot (port 8650) ✅ ; **uniformisé le 01/09** : re-déployé sur image à jour, gateway en uid 10000 (comme les 3 autres), data préservée (tar de précaution dans `/var/backups/lean-precaution/`).
- [ ] **loukyrunner** : doublon de hermesrunner (même bot @pipou200bot). Si un bot distinct est attendu, fournir son token.
- [ ] Mapping complet **nom_agent → token → mode** documenté dans `/root/.fleet_tokens.env` (mode 600).

### Infrastructure / Syncthing / nginx
- [ ] **Syncthing** : fournir les **device IDs** des appareils (PC/mobile) pour activer la sync du vault Obsidian ; déclarer le folder `obsidian-vault` avec `.stfolder`.
- [ ] **nginx** : à définir (usage en cours de réflexion) — non installé.

### Sécurité
- [x] **Port 8650-8653** (APIs agents Docker) : **DENY UFW** — ports publiés mais bloqués publiquement.
- [x] **Port 8642** (API gateway natif) : **DENY UFW**.
- [x] **Port 22000** (Syncthing) : **FERMÉ le 01/09** — remplacé par Tailscale (serveur enrôlé REDACTED ; installer l'app Tailscale sur PC/téléphone pour le sync futur).
- [x] **Déplacer les secrets de `/root/.bashrc`** vers `/etc/secrets/` — **fait le 30/08 (audit)** : 55 variables migrées vers `/etc/secrets/hermes.env` (600), `.bashrc` en 600 + sourcing, backup `/root/.bashrc.preaudit-20260830`.
- [ ] Activer la **redaction des secrets** dans la config Hermes (`security.redact_secrets: true`) — désactivée par défaut.
- [ ] Changer le **mot de passe root Contabo** (via console VNC) si pas déjà fait.
- [x] **Uniformiser le conteneur leanConstruction** : ✅ **fait le 01/09** — compose régénéré sans `entrypoint: []`, image `hermes-agent:latest`, gateway en uid 10000, data `10000:10000 700`, Telegram `connected`.
- [x] **Sauvegardes quotidiennes** : ✅ **fait le 01/09** — `/usr/local/bin/vps-backup.sh` (cron 4h30, archive ~1,3 Go dans `/var/backups/vps-fleet/`, rétention 7 j, log `/var/log/vps-backup.log`) + rapatriement local automatique `Installation/scripts/vps-backup-pull.sh` (tâche schtasks à créer, voir EXPLICATION_SECURITE.md) + NAS Synology en 2ᵉ temps (le NAS pull en SSH, procédure documentée).
- [x] **Tailscale** : ✅ **installé le 01/09** — serveur enrôlé (`REDACTED`, tailnet REDACTED_EMAIL). À faire côté user : installer l'app Tailscale sur PC/téléphone pour accéder aux services via le tailnet.
- [x] **Clés SSH durcies** : ✅ **01/09** — passphrase sur `REDACTED` + fonction `vps` (agent SSH au socket fixe `~/.ssh/agent.sock`, 1× par session WSL) + archive GPG des clés (`Installation/scripts/backup-keys.sh`, à copier sur USB).
- [ ] **Nettoyer `/etc/ssh/sshd_config` principal** (`PermitRootLogin yes` / `X11Forwarding yes` morts, neutralisés par `00-hardening.conf` mais piégeux).
- [ ] **Binder le gateway natif sur 127.0.0.1** (défense en profondeur, UFW deny 8642 déjà en place).
- [ ] **Purger les résidus snapd** (`apt purge snapd`, `/snap`) et mettre en place **logrotate AIDE** (logs > 40 Mo).

### Vérifications / Sauvegardes
- [ ] Tester la **persistance après reboot** (services systemd + conteneurs `restart: unless-stopped`).
- [ ] Vérifier la bonne synchronisation du vault Obsidian via Syncthing après premiers changements.
- [ ] **HermesConfig** : tester un message Telegram réel vers @ArevLeanyBot + réponse de l'agent ; créer le bot Ops + routines après validation client.
- [ ] **HermesCapabilities** : M2 — implémentation réelle C5 rag-supabase (Supabase TEST → MCP sur arev) puis C1 email-gmail ; réplication contrats C2/C3/C4/C6/C7.
- [ ] **HermesConfig** : intégrer `/home/admin/hermes-fleet/HermesConfig/instances/` (data) + `clients/` à la procédure de backup.
- [x] **AIDE** : base régénérée le 30/08 **21:34** après remédiation + exclusions churn (check de validation 0 diff) ; cron 3h → `aide-check-alert.sh` (alerte Telegram **si** différences uniquement). Refaire `aideinit --force` après tout changement système majeur.
- [x] **Rotation du token du bot d'alerte** — **faite le 30/08 21:50** : nouveau token dans `/etc/secrets/hermes.env` (600), ancien révoqué (API 401), nouveau validé (API 200, @pipou200bot), test d'envoi OK. Backup : `/etc/secrets/hermes.env.pre-rotation-20260830`.
- [ ] Nettoyer les backups pré-audit sur le serveur une fois la stabilité confirmée (`/root/.bashrc.preaudit-20260830`, `/etc/pam.d/sshd.preaudit-20260830`, `/etc/secrets/hermes.env.preaudit-quote-20260830`, `/etc/cron.d/aide.preaudit-20260830`).
- [x] **PROCÉDURE DE BACKUP** : inclure **`/home/admin/hermes-fleet/`** (données + configs des agents Docker : sessions, memories, state.db) — **absent du backup `backup.tar.gz` d'origine**, ce qui a causé la perte des historiques des agents Docker. Les données à sauvegarder :
  - `/home/admin/hermes-fleet/` (agents Docker : `hermes-fleet/<agent>/data/`)
  - `/home/<runner>/.hermes/` (runners natifs : sessions, memories, state.db, .env)
  - `/root/.fleet_tokens.env`, `/etc/secrets/hermes.env` et `/root/.bashrc` (tokens + clés — les deux premiers en 600, **indispensables** au redéploiement)
  - `/home/syncthing/obsidian-vault/` (vault Obsidian)

> **Leçon apprise (plan A)** : les 4 agents Docker (leanConstruction, copycat, aquisition, va_agent) ont été **recréés à neuf** — leurs historiques de conversation antérieurs ne sont PAS dans l'archive. Seuls les runners natifs ont conservé leurs données (hermesrunner 62 sessions, loukyrunner 67, arev 4106).

---

## 7. Commandes utiles (rappel)

```bash
# Connexion
ssh nemo

# Logs agents
sudo journalctl -u hermes-gateway-hermesrunner -f
sudo journalctl -u hermes-gateway-arev -f
sudo docker logs hermes-leanConstruction --tail 50

# État gateway (state file)
cat /home/hermesrunner/.hermes/gateway_state.json | python3 -m json.tool
cat /home/arev-chantier-runner/.hermes/gateway_state.json | python3 -m json.tool

# Déployer un agent dockerisé
cd /home/admin/hermes-fleet && ./spawn-hermes.sh <nom> "<token>"

# Syncthing
sync-status

# Sécurité
sudo ufw status verbose
sudo fail2ban-client status sshd

# Test manuel de l'alerte Telegram
sudo /usr/local/bin/telegram-alert.sh "Test" "message de test"
```

---

## 8. Incident & durcissement — 01 au 06/09/2026

### Incident : réseau public figé 3 jours (03/09 10:47 → 06/09 ~15:03)
- Symptôme : SSH public, ICMP et tailnet tous injoignables, mais l'OS vivant (cron AIDE/backup ont tourné, alertes Telegram parties). UFW/fail2ban/authorized_keys vérifiés — **aucun lien avec nos changements**.
- Cause exacte non déterminée dans les journaux (aucune entrée networkd/kernel sur la fenêtre) — incident réseau probable côté VM/hôte Contabo.
- Résolution : reboot volontaire le 06/09 à 15:03 (shutdown propre dans les journaux).
- **Test de persistance après reboot : RÉUSSI** — tout est revenu automatiquement (sshd, 6 agents Telegram connected, tailscaled, fail2ban, crons).

### Durcissements appliqués (01-06/09)
- **Tailscale** installé (serveur REDACTED), port 22000 fermé définitivement.
- **Sauvegardes** : cron 4h30 → `/var/backups/vps-fleet/` (1,3 Go, rétention 7 j) + clé dédiée restreinte (`id_vps_backup`, `restrict,command=`) + rapatriement auto PC (`vps-backup-pull.sh` + schtasks) + NAS Synology documenté.
- **Clés SSH** : passphrase sur `REDACTED`, fonction `vps` (agent au socket fixe), archive GPG (`backup-keys.sh`), `authorized_keys` pruné à 2 lignes.
- **Token bot @pipou200bot roté** (01/09) — ⚠️ leçon : le même token sert le runner natif → mettre à jour AUSSI `/home/hermesrunner/.hermes/.env` à chaque rotation.
- **leanConstruction uniformisé** (gateway uid 10000, compose régénéré).
- **AIDE v4** : exclusions de churn exhaustives (maintenance apt/notifier, /run/*, swap, instances pro), heartbeat quotidien **🟢 OK / 🚨 NOK** sur Telegram avec **triage LLM (DeepSeek)** + fallback brut, logs conservés 7 jours (purge 5h).
- **Clavier console VNC en AZERTY** (`/etc/vconsole.conf` KEYMAP=fr) + **swap 2G** (`/swapfile`, fstab) + **fail2ban `ignoreip` REDACTED** (jamais de ban accidentel de l'IP admin).

### Protocole alertes AIDE
1. 🟢 `OK` → rien à faire (maintenance/bénéfique, détail dans `/var/log/aide/` 7 j).
2. 🚨 `NOK` → vérifier les chemins listés : session Doer en cours = attendu (vérifier avec l'agent), sinon investiguer.
3. Après une fenêtre de déploiement : régénérer la base (`/tmp/regen-aide.sh` à recréer si `/tmp` purgé : `aideinit --force -y` → `mv aide.db.new aide.db`).

### Vault Obsidian : accès agents via ACL (06-07/09)
- Problème : les fichiers syncés par Syncthing appartiennent à `syncthing` (uid 112) — les `.md` en `600` étaient **illisibles pour les agents Docker (uid 10000)** (ex. Aquisition/Fateh).
- **Fix retenu : ACL** (pas de chown !) : `setfacl -R -m u:10000:rwX` + `setfacl -R -d -m u:10000:rwX` sur `/home/syncthing/obsidian-vault` (stocké sur disque → persistant, héritage automatique pour les nouveaux fichiers syncés).
- **Pourquoi PAS le chown 10000 proposé par l'agent** : priverait syncthing du droit d'écriture → sync cassée, et le problème reviendrait sur chaque nouveau fichier.
- Vérifié : lecture + écriture OK en uid 10000 dans le conteneur (`docker exec -u 10000`), syncthing `idle` intact, héritage prouvé (fichier créé par syncthing → ACL présente).
- ⚠️ Test hôte piégé : `/home/syncthing` est en 750 → tester **dans le conteneur** (`docker exec -u 10000`), pas depuis le chemin hôte.

### Agent 7 : Alinea_icp_reviewer (06-07/09)
- Conteneur dédié `Alinea_icp_reviewer` (image `hermes-agent:latest`, **aucun port exposé**, `mem_limit 2g`, `no-new-privileges`), gateway uid 10000, Telegram **connected**.
- Token : bot dédié `8976902110:…` (compose en 600). `TELEGRAM_ALLOWED_USERS/HOME_CHANNEL = 5917823647`.
- **Chromium 152 installé dans le conteneur** (apt Debian 13, headless OK en uid 10000) — ⚠️ vit dans la couche conteneur : **perdu si le conteneur est recréé** (survit au stop/start) → réinstallation : `docker exec Alinea_icp_reviewer apt-get install -y chromium` (ou l'agent lui-même).
- SOUL.md stub en place → **Redouane écrit la persona finale** dans `hermes-fleet/Alinea_icp_reviewer/data/SOUL.md`.
- Intégrations : nightly check (7/7 agents), backup fleet (inclus), AIDE (exclusion data récursive). **Vault monté le 07/09** (`/home/syncthing/obsidian-vault:/opt/vault`, lecture+écriture via les ACL u:10000 déjà en place).

### Agent 8 : Bercy (07/09)
- Conteneur dédié `Bercy` (image `hermes-agent:latest`, aucun port exposé, mem 2g, no-new-privileges), gateway uid 10000, Telegram connected.
- Token : bot dédié `8732547964:…` (compose 600). ALLOWED_USERS/HOME_CHANNEL = 5917823647.
- **Vault Obsidian monté en lecture/écriture** (`/opt/vault`, accès via ACL u:10000) — testé dans le conteneur.
- SOUL.md stub → Redouane écrit la persona finale dans `hermes-fleet/Bercy/data/SOUL.md`.
- Intégrations : nightly check (8/8 agents), backup fleet inclus, AIDE couvert.
