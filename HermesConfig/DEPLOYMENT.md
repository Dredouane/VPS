# 🚀 DEPLOYMENT.md — Deploying a HermesConfig client on the VPS

Prerequisites: hardened VPS `$VPS_HOSTNAME` (see `../Installation/DOCUMENTATION_VPS.md`),
Docker active, `hermes-agent` image built or buildable (`hermes-repo`),
`ssh nemo` access.

## 0. Sync of the local sub-project → VPS

```bash
# From the PC (WSL)
rsync -av --exclude 'instances/' --exclude '*.env' \
  ~/dev/VPS/HermesConfig/ nemo:/home/admin/hermes-fleet/HermesConfig/

ssh nemo
sudo chown -R admin:admin /home/admin/hermes-fleet/HermesConfig
chmod +x /home/admin/hermes-fleet/HermesConfig/scripts/*.sh
```

## 1. Prepare the client

```bash
cd /home/admin/hermes-fleet/HermesConfig
sudo cp -r clients/TEMPLATE clients/<slug>
sudo vim clients/<slug>/client.env   # TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USERS, DEEPSEEK_API_KEY
sudo chmod 600 clients/<slug>/client.env
sudo vim clients/<slug>/soul.md      # adapt the contract (knows/can/refuses/escalates)
```

## 2. Telegram token — option A (validated)

1. Create a **new bot** via @BotFather (e.g. `@Arev_Pro_AssistBot`) —
   the existing native runner (`arev-chantier-runner`, @Arev_Chantiers_AssistBot)
   stays in parallel during tests → **zero 409 conflict**.
2. Get the `TELEGRAM_ALLOWED_USERS`: the user sends a message to the
   new bot then we read the ID (`docker logs hermes-<slug>-pro | grep -i "from"`).

> Option B (cutover of the existing token): **stop the native runner first**
> (`sudo systemctl stop hermes-gateway-arev && sudo systemctl disable hermes-gateway-arev`),
> otherwise Telegram polling conflict. Document the cutover in the vault.

## 3. Deploy

```bash
sudo ./scripts/spawn-hermes-pro.sh <slug>
# The script: validates client.env, allocates a free port (127.0.0.1), creates
# data-dir (10000:10000, 700) + scoped client vault (ACL syncthing),
# installs pro config.yaml + SOUL.md, generates the compose (600, no secrets),
# docker compose up, checks /health.
```

## 4. Post-deployment checks

```bash
sudo ./scripts/audit-hermes-pro.sh <slug>

docker logs hermes-<slug>-pro --tail 30          # no errors, config.yaml accepted
docker exec hermes-<slug>-pro hermes doctor      # runtime config validation
# Telegram: test message from an allowed user → agent response
# Vault: the agent writes a test note in /opt/vault → visible in Obsidian
```

Checklist:
- [ ] container `running` + healthcheck `healthy`
- [ ] port bound to `127.0.0.1` only
- [ ] `gateway_state.json` → `"telegram":{"state":"connected"`
- [ ] vault write OK (visible via Syncthing/Obsidian)
- [ ] `client.env` at 600, compose without secrets, pinned image
- [ ] `SOUL.md` contract reviewed (refuses + escalates) by the client

## 5. After validation: Ops bot + routines

```bash
docker exec -it hermes-<slug>-pro bash
hermes profile create ops
hermes cron create --profile ops "0 7 * * 1" "Weekly report…"
```
Follow `hermes/bots/README.md` + `hermes/routines/README.md`, document in
the vault.

## 6. Image update (pinned)

```bash
cd /home/admin/hermes-fleet/hermes-repo && sudo git pull
sudo docker build -t hermes-agent:latest .
# Test on a non-critical agent, then:
sudo docker tag hermes-agent:latest hermes-agent:<new-version>
# Update HERMES_IMAGE_TAG (client.env) and redeploy:
sudo ./scripts/spawn-hermes-pro.sh <slug> --force-config
```

## 7. Rollback / manual takeover

```bash
docker compose -f instances/<slug>/docker-compose.yml down   # stop (data kept)
docker compose -f instances/<slug>/docker-compose.yml up -d  # restart
# Full destruction (⚠️ sessions/memory loss):
docker compose -f instances/<slug>/docker-compose.yml down -v \
  && rm -rf instances/<slug>
# Backup before any intervention:
sudo tar czf /root/hermes-<slug>-data-$(date +%F).tgz -C instances/<slug> data
```

## 8. Obsidian vault

The client sub-directory `/home/syncthing/obsidian-vault/VPS/HermesConfig/<slug>/`
is created by the spawn (owner 10000:10000 + syncthing ACL). Expected
notes: `Bot Ops.md`, `Skills.md`, `Incidents.md`, decision tracking.
See `VPS/HermesConfig/` on the Obsidian side (PC/mobile via Syncthing).
