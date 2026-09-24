# Syncthing & Obsidian — Guide d'exploitation (VPS Contabo)

**Serveur** : `$VPS_HOSTNAME` — Ubuntu 22.04 LTS — IP `$VPS_IP`
**Dernière mise à jour** : 30/08/2026

---

## 1. Architecture

### 1.1 Devices Syncthing

| Appareil | Nom | Device ID | Rôle | État |
|---|---|---|---|---|
| **VPS** | `$VPS_HOSTNAME` | `$SYNCTHING_DEVICE_ID | Serveur | ✅ |
| **PC** (Windows/WSL) | `$DESKTOP_DEVICE` | `GPMPYZ2-7JRJHKB-KYUMBCW-HULB5EG-HRQXCCU-FP5VEZT-UNUGXUM-54LFAQE` | Client | ✅ connecté (relay) |
| **Mobile** (Android) | `Android-Mobile` | `67QMEVF-UF4DO7C-3BWARCW-OYJKEDH-FYZ2BX7-P32OXQS-ZCNA2OM-MBZM2QX` | Client | ⚠️ déclaré, connexion à confirmer |

### 1.2 Folder partagé

| Paramètre | Valeur |
|---|---|
| Folder ID | `obsidian-vault` |
| Label | `Obsidian Vault` |
| Chemin VPS | `/home/syncthing/obsidian-vault` |
| Type | `sendreceive` |
| Taille | ~612 Mo — 15 342 fichiers |
| État | synchronisé à 100 % (`inSync 599 032 479 octets`, `needFiles: 0`) |
| Devices partagés | $VPS_HOSTNAME + $DESKTOP_DEVICE + Android-Mobile |

### 1.3 Consommateurs (agents Hermes Docker)

Les 4 agents Docker montent le vault en lecture dans le conteneur (`/opt/vault`) :
`hermes-leanConstruction`, `hermes-copycat`, `hermes-aquisition`, `hermes-va_agent`
→ montage `- /home/syncthing/obsidian-vault:/opt/vault`

---

## 2. Connexions & Accès

### 2.1 SSH (port $VPS_SSH_PORT)

```bash
ssh nemo            # admin@$VPS_IP:$VPS_SSH_PORT — clé ~/.ssh/$VPS_SSH_KEY (sans passphrase)
```

Config `~/.ssh/config` :
```
Host nemo
    HostName $VPS_IP
    User admin
    Port $VPS_SSH_PORT
    IdentityFile ~/.ssh/$VPS_SSH_KEY
    IdentitiesOnly yes
```

> **Historique** : l'ancien alias `nemo` du `.bashrc` pointait vers `root@22` (bloqué par le durcissement) et écrasait la config SSH — il a été commenté.

### 2.2 GUI Syncthing du VPS (tunnel SSH)

Le GUI écoute sur `127.0.0.1:8384` (localhost uniquement). **Jamais exposé publiquement** — accès via tunnel SSH :

```bash
syncthing-gui      # alias = ssh -N -L 8384:127.0.0.1:8384 nemo
```

Puis ouvrir : **http://localhost:8384** (GUI du VPS, device `$VPS_HOSTNAME`).

Arrêt du tunnel : `Ctrl+C`.

**Prérequis SSH** : `AllowTcpForwarding local` activé côté VPS (`/etc/ssh/sshd_config.d/10-tunnel.conf`). Autorise `ssh -L` mais bloque `-R`/`-D`.

---

## 3. Configuration système

### 3.1 Service

```bash
systemctl status syncthing@syncthing.service    # actif + enabled (boot)
systemctl restart syncthing@syncthing.service   # redémarrage
```

### 3.2 Pare-feu UFW

```
22000/tcp   ALLOW   $SOURCE_IP    # Syncthing — restreint à l'IP du PC (WSL)
$VPS_SSH_PORT/tcp    ALLOW   Anywhere        # SSH durci
```

> **Attention** : si l'IP publique du PC (WSL) change, mettre à jour la règle :
> ```bash
> sudo ufw delete allow from $SOURCE_IP to any port 22000 proto tcp
> sudo ufw allow from <NOUVELLE_IP> to any port 22000 proto tcp
> ```

### 3.3 Relais global (nomades)

`relaysEnabled: true` + `listenAddress: default` + annonces globales actives.
→ Les appareils mobiles (4G/5G) se synchronisent **via relais** sans ouverture d'IP fixe dans UFW.
Le PC se connecte actuellement via `relay-server 80.231.63.246:443`.

### 3.4 Ports d'écoute Syncthing

| Port | Interface | Usage |
|---|---|---|
| 8384/tcp | 127.0.0.1 | GUI web |
| 22000/tcp | * (toutes) | Transfert de données (filtré par UFW) |
| 21027/udp | * | Découverte locale |

---

## 4. Procédures

### 4.1 Accéder au GUI du VPS

```bash
syncthing-gui     # puis navigateur → http://localhost:8384
```

### 4.2 Redémarrer Syncthing

```bash
ssh nemo
sudo systemctl restart syncthing@syncthing.service
```

### 4.3 Ajouter un nouvel appareil

1. Depuis l'appareil : copier son Device ID (Actions → Show ID / Réglages → Appareil).
2. Sur le VPS (GUI via tunnel, ou API REST) : ajouter le device.
3. Depuis l'appareil : ajouter le Device ID du VPS `$SYNCTHING_DEVICE_ID (appairage bidirectionnel obligatoire).
4. Partager le folder `obsidian-vault` (même Folder ID des deux côtés).
5. Si connexion directe souhaitée : ouvrir `22000/tcp` pour l'IP de l'appareil dans UFW (sinon le relais gère).

### 4.4 Diagnostics rapides (via GUI tunnel ou API)

```bash
# État du folder
curl -s -H "X-API-Key: <apikey>" "http://127.0.0.1:8384/rest/db/status?folder=obsidian-vault"

# Connexions devices
curl -s -H "X-API-Key: <apikey>" "http://127.0.0.1:8384/rest/system/connections"
```

L'API key se trouve dans `/home/syncthing/.config/syncthing/config.xml` (bloc `<gui>`).

---

## 5. Dépannage

### 5.1 Android non connecté

- Vérifier l'**appairage bidirectionnel** : le device VPS doit être ajouté dans l'app Android.
- Vérifier que le **folder** `obsidian-vault` est partagé avec le mobile.
- **Relay côté Android** : activer "Utiliser des relais" dans les réglages du device.
- Vérifier la **batterie/optimisation** Android (ne pas tuer Syncthing en arrière-plan).
- Si besoin : ouvrir `22000/tcp` pour l'IP du mobile dans UFW.

### 5.2 IP du PC (WSL) change

Mettre à jour la règle UFW (voir §3.2). Alternative durable : passer le PC en relay (comme le mobile).

### 5.3 Conflits de synchronisation

- Les conflits sont conservés par Syncthing (`*.sync-conflict-*`) dans le vault.
- Pour ignorer certains dossiers (caches, temp) : créer un fichier `.stignore` à la racine du vault (à faire sur TOUS les devices, car il se synchronise).

### 5.4 Le GUI répond mais page blanche

- Vérifier que le tunnel est actif (port 8384 en écoute local).
- Tester `curl -o /dev/null -w "%{http_code}" http://localhost:8384/` → doit renvoyer 200.

---

## 6. Sauvegarde (recommandations)

**Leçon apprise** : le backup `backup.tar.gz` d'origine n'incluait PAS `/home/admin/hermes-fleet/` → perte des historiques des agents Docker. Inclure désormais :

| Chemin | Contenu |
|---|---|
| `/home/syncthing/obsidian-vault/` | Vault Obsidian (612 Mo) |
| `/home/admin/hermes-fleet/` | Agents Docker : sessions, memories, state.db, configs |
| `/home/<runner>/.hermes/` | Runners natifs : sessions, memories, state.db, .env |
| `/root/.fleet_tokens.env` | Tokens Telegram des agents Docker |
| `/root/.bashrc` | Clés API + fonctions/alias fleet |
| `/etc/docker/` | `daemon.json` durci |

---

## 7. Rappels sécurité

- ✅ GUI Syncthing **jamais exposé publiquement** (tunnel SSH uniquement).
- ✅ Port 22000 **restreint** à l'IP du PC (WSL).
- ✅ Relais actif → pas d'ouverture globale nécessaire pour les nomades.
- ✅ Tunnel SSH limité à `AllowTcpForwarding local` (`-R`/`-D` bloqués).
- ⚠️ Les **secrets** restent en clair dans `/root/.bashrc` → à déplacer vers `/etc/secrets/` (recommandé).
- ⚠️ Si l'IP WSL change, mettre à jour la règle UFW 22000.

---

## 8. Référence rapide — Identifiants

```
VPS  ($VPS_HOSTNAME)  : $SYNCTHING_DEVICE_ID
PC   ($DESKTOP_DEVICE) : GPMPYZ2-7JRJHKB-KYUMBCW-HULB5EG-HRQXCCU-FP5VEZT-UNUGXUM-54LFAQE
Mobile (Android)    : 67QMEVF-UF4DO7C-3BWARCW-OYJKEDH-FYZ2BX7-P32OXQS-ZCNA2OM-MBZM2QX
Folder              : obsidian-vault  →  /home/syncthing/obsidian-vault
SSH                 : ssh nemo  (admin@$VPS_IP:$VPS_SSH_PORT)
GUI VPS             : syncthing-gui  →  http://localhost:8384
```
