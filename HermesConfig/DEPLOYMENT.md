# 🚀 DEPLOYMENT.md — Déploiement d'un client HermesConfig sur le VPS

Pré-requis : VPS `REDACTED` durci (voir `../Installation/DOCUMENTATION_VPS.md`),
Docker actif, image `hermes-agent` buildée ou buildable (`hermes-repo`),
accès `ssh nemo`.

## 0. Sync du sous-projet local → VPS

```bash
# Depuis le PC (WSL)
rsync -av --exclude 'instances/' --exclude '*.env' \
  ~/dev/VPS/HermesConfig/ nemo:/home/admin/hermes-fleet/HermesConfig/

ssh nemo
sudo chown -R admin:admin /home/admin/hermes-fleet/HermesConfig
chmod +x /home/admin/hermes-fleet/HermesConfig/scripts/*.sh
```

## 1. Préparer le client

```bash
cd /home/admin/hermes-fleet/HermesConfig
sudo cp -r clients/TEMPLATE clients/<slug>
sudo vim clients/<slug>/client.env   # TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USERS, DEEPSEEK_API_KEY
sudo chmod 600 clients/<slug>/client.env
sudo vim clients/<slug>/soul.md      # adapter le contrat (sait/peut/refuse/escalade)
```

## 2. Token Telegram — option A (validée)

1. Créer un **nouveau bot** via @BotFather (ex. `@Arev_Pro_AssistBot`) —
   le runner natif existant (`arev-chantier-runner`, @Arev_Chantiers_AssistBot)
   reste en parallèle pendant les tests → **zéro conflit 409**.
2. Récupérer l'`TELEGRAM_ALLOWED_USERS` : l'utilisateur envoie un message au
   nouveau bot puis on lit l'ID (`docker logs hermes-<slug>-pro | grep -i "from"`).

> Option B (cutover du token existant) : **arrêter le runner natif d'abord**
> (`sudo systemctl stop hermes-gateway-arev && sudo systemctl disable hermes-gateway-arev`),
> sinon conflit de polling Telegram. Documenter le cutover dans le vault.

## 3. Déployer

```bash
sudo ./scripts/spawn-hermes-pro.sh <slug>
# Le script: valide client.env, alloue un port libre (127.0.0.1), crée
# data-dir (10000:10000, 700) + vault client scopé (ACL syncthing),
# installe config.yaml pro + SOUL.md, génère le compose (600, sans secrets),
# docker compose up, vérifie /health.
```

## 4. Vérifications post-déploiement

```bash
sudo ./scripts/audit-hermes-pro.sh <slug>

docker logs hermes-<slug>-pro --tail 30          # pas d'erreur, config.yaml acceptée
docker exec hermes-<slug>-pro hermes doctor      # validation config runtime
# Telegram : message de test depuis un user autorisé → réponse de l'agent
# Vault : l'agent écrit une note de test dans /opt/vault → visible dans Obsidian
```

Checklist :
- [ ] conteneur `running` + healthcheck `healthy`
- [ ] port lié à `127.0.0.1` uniquement
- [ ] `gateway_state.json` → `"telegram":{"state":"connected"`
- [ ] écriture vault OK (visible via Syncthing/Obsidian)
- [ ] `client.env` en 600, compose sans secrets, image pinnée
- [ ] contrat `SOUL.md` relu (refus + escalade) par le client

## 5. Après validation : bot Ops + routines

```bash
docker exec -it hermes-<slug>-pro bash
hermes profile create ops
hermes cron create --profile ops "0 7 * * 1" "Rapport hebdo…"
```
Suivre `hermes/bots/README.md` + `hermes/routines/README.md`, documenter dans
le vault.

## 6. Mise à jour de l'image (pinnée)

```bash
cd /home/admin/hermes-fleet/hermes-repo && sudo git pull
sudo docker build -t hermes-agent:latest .
# Test sur un agent non-critique, puis :
sudo docker tag hermes-agent:latest hermes-agent:<nouvelle-version>
# Mettre à jour HERMES_IMAGE_TAG (client.env) et redéployer :
sudo ./scripts/spawn-hermes-pro.sh <slug> --force-config
```

## 7. Rollback / reprise en main

```bash
docker compose -f instances/<slug>/docker-compose.yml down   # stop (data conservé)
docker compose -f instances/<slug>/docker-compose.yml up -d  # relance
# Destruction complète (⚠️ perte sessions/mémoire) :
docker compose -f instances/<slug>/docker-compose.yml down -v \
  && rm -rf instances/<slug>
# Backup avant toute intervention :
sudo tar czf /root/hermes-<slug>-data-$(date +%F).tgz -C instances/<slug> data
```

## 8. Vault Obsidian

Le sous-dossier client `/home/syncthing/obsidian-vault/VPS/HermesConfig/<slug>/`
est créé par le spawn (propriétaire 10000:10000 + ACL syncthing). Notes
attendues : `Bot Ops.md`, `Skills.md`, `Incidents.md`, suivi des décisions.
Consulter `VPS/HermesConfig/` côté Obsidian (PC/mobile via Syncthing).
