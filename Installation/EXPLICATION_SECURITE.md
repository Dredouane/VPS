# 🛡️ Explication sécurité — VPS nemo (avant / après)

> Pourquoi le serveur a été détruit, ce qui a changé, et pourquoi il est maintenant
> démontrablement plus dur à attaquer. Rédigé après l'audit + remédiation du 30/08/2026,
> complété le 01/09/2026 (4 derniers points réglés).

---

## 1. Avant : une maison avec les clés sous le paillasson

Trois faiblesses fatales **combinées** :

| Faiblesse | Pourquoi c'était fatal |
|---|---|
| **SSH port 22, root + mot de passe** | Des milliers de robots scannent internet 24h/24 et testent des mots de passe sur le port 22. Un mot de passe faible = compromission en heures. Et `root` = le compte qui contrôle TOUT. |
| **nginx exposé sur le seul port ouvert** | Un service web exposé = un programme complexe face au monde. Il suffit d'UNE faille (version ancienne, mauvaise config) pour un accès direct, sans mot de passe. |
| **Tous les secrets dans `.bashrc`** | Le plus grave. Une fois dedans, l'attaquant lisait tout : clés DeepSeek/OpenRouter/Gemini, tokens Telegram, mots de passe Supabase, JWT prod, OAuth Gmail. Ces clés donnent accès aux comptes cloud **même après réinstallation** — le vol de secrets survit à la destruction de la machine. |

Et surtout : **aucune détection**. Pas de pare-feu structuré, pas de bannissement, pas de contrôle d'intégrité, pas d'alerte.

### Le scénario probable de l'attaque
```
scan du port 22 → brute force (ou faille nginx) → shell → lecture .bashrc
→ réutilisation des clés cloud + installation de charge (minage) → destruction
```
La seule "réponse" possible était la réinstallation — preuve qu'il n'y avait ni alarme ni containment.

---

## 2. Maintenant : défense en profondeur

Le principe n'est plus "une porte sécurisée" mais **des couches qui se relaient** — chaque couche suppose que la précédente peut être percée :

| Couche | Avant | Maintenant |
|---|---|---|
| 🚪 **La porte** | port 22, root, mot de passe | Port **2222**, **clé seule** (impossible de taper un mot de passe), root **interdit**, 3 tentatives max, forwarding interdit. Le scan du port 22 ne trouve même plus de porte. |
| 🧱 **Les murs** | nginx exposé, Docker shuntant le firewall | **UFW refuse tout par défaut** + chaîne `DOCKER-USER` qui empêche Docker de contourner UFW. Seuls joignables : 2222 + Syncthing (réservé à l'IP locale). nginx supprimé. |
| 🏦 **Le coffre** | secrets dans `.bashrc` | Secrets dans `/etc/secrets/hermes.env` (600, root uniquement), `.bashrc` verrouillé 600, token du bot **roté** après exposition. |
| 🚨 **L'alarme** | rien | **fail2ban** (bannit 24 h — 2 IP déjà bannies), **hook PAM** (alerte Telegram si connexion SSH inhabituelle), **AIDE** (alerte Telegram si un fichier système est altéré). |
| 🔒 **Cloisonnement** | tout en root | Agents dans des conteneurs sans privilèges (`no-new-privileges`, uid 10000), gateways natifs en users dédiés, un seul compte sudo (`admin`), porte dérobée cloud-init `ubuntu` **supprimée**. |
| 🔧 **Entretien** | rien | Patchs sécurité automatiques (unattended-upgrades), durcissement kernel (sysctl), snapd désactivé. |

---

## 3. Démonstrations du 30/08 (on a attaqué pour vérifier)

- Connexion `root` → **rejetée** (le serveur n'offre que la clé publique)
- Connexion par mot de passe → **rejetée**
- 9 ports sondés **depuis l'extérieur** (22, 25, 8384, 8642, 8650-8653, 22000) → **tous fermés** ; seul 2222 ouvert
- fail2ban avec **2 IP bannies** au moment de l'audit (la chaîne bannissement→UFW est prouvée)
- Alertes Telegram **réellement reçues** (connexions, altérations AIDE)
- Le système a détecté spontanément une création de fichier inattendue (`/home/admin/.hermes`)

---

## 4. Les 4 points restants et leurs solutions

| # | Point | Solution(s) | Statut |
|---|---|---|---|
| 1 | `leanConstruction` tournait en root dans son conteneur | Re-déploiement via compose régénéré (image à jour, entrypoint drop → uid 10000 comme les 3 autres), données préservées | ✅ Fait le 01/09 |
| 2 | Sauvegardes inexistantes | **A** : cron serveur 4h30 → `/var/backups/vps-fleet/` (tar.gz 1,3 Go, rétention 7 j) · **B** : script local `vps-backup-pull.sh` + tâche planifiée Windows (rapatriement auto) · **C (2ᵉ temps)** : NAS Synology (le NAS pull en SSH) | ✅ A+B faits le 01/09, C documenté |
| 3 | Dépendance à l'IP publique (allowlist SSH, Syncthing 22000) | **Tailscale** : serveur enrôlé (REDACTED) ; port 22000 **fermé définitivement en UFW** ; accès SSH possible même si l'IP change | ✅ Fait le 01/09 |
| 4 | Clés SSH = le secret le plus précieux | Passphrase sur `REDACTED` (dans le password manager) + commande `vps` (agent auto au socket fixe) + archive GPG chiffrée sur USB (`backup-keys.sh`) | ✅ Fait le 01/09 (resté : copie USB) |

---

## 5. Ton rituel quotidien (30 secondes)

1. Ouvrir un terminal WSL → taper **`vps`** → passphrase **une fois** → « ✅ VPS joignable »
2. Lancer opencode depuis ce terminal → tout fonctionne (connexions agents, skills, backups)
3. Le VPS te préviendra sur Telegram : connexion inhabituelle, fichier altéré, (et le cron de sauvegarde tourne seul à 4h30)

## 6. Rappel : un serveur n'est jamais "secure"

Il est **moins attaQUABLE et surveillé**. Les vrais boucliers restants :
- **Les sauvegardes** (faites + rapatriées — la capacité à restaurer vaut plus que n'importe quel durcissement)
- **Tes clés privées** (passphrase dans le manager, archive GPG sur USB)
- La vigilance : toute alerte Telegram inhabituelle = à regarder, pas à ignorer.

---

## 7. Procédures côté utilisateur (à faire une fois)

### 7.1 Archive GPG des clés → clé USB
```bash
bash ~/dev/VPS/Installation/scripts/backup-keys.sh    # passphrase GPG = celle de ta clé SSH
```
Puis : copier `~/backups/keys/*.gpg` sur **une clé USB** et noter la passphrase dans le password manager. Restauration documentée en sortie du script.

### 7.2 Tâche planifiée Windows (rapatriement automatique du backup)
Dans **Windows** (CMD ou PowerShell) :
```
schtasks /Create /TN "VPS Backup Pull" /TR "wsl.exe -e bash /home/redouane/dev/VPS/Installation/scripts/vps-backup-pull.sh" /SC DAILY /ST 11:00
```
Le script utilise la clé **dédiée** `id_vps_backup` (sans passphrase mais enfermée côté serveur : `restrict` + commande forcée = streamer uniquement la dernière archive). Il ne peut rien faire d'autre, même volée. Vérification : `~/backups/vps-fleet/fleet-latest.tar.gz`.

### 7.3 Tailscale sur tes appareils
1. Installer l'app (PC : https://tailscale.com/download ; mobile : store) → login **REDACTED_EMAIL**
2. Le serveur est déjà enrôlé : **REDACTED**
3. Le futur sync Syncthing se fera via cette IP (le port 22000 public est fermé)

### 7.4 NAS Synology (2ᵉ temps — le NAS pull, pas le VPS)
1. DSM → Panneau de configuration → Terminal & SNMP → activer SSH
2. Sur le NAS : `ssh-keygen -t ed25519 -f /volume1/backups/.ssh/nemo_key -N ""` → copier le `.pub` dans `/home/admin/.ssh/authorized_keys` du VPS (avec `restrict,command=` comme pour `id_vps_backup` si on veut restreindre, ou en clé de lecture rsync)
3. DSM → Planificateur de tâches → tâche planifiée (root) → script : `rsync -az --delete -e "ssh -i /volume1/backups/.ssh/nemo_key -p 2222" admin@REDACTED:/var/backups/vps-fleet/ /volume1/backups/nemo/`

### 7.5 Hygiène locale (hors VPS) — À FAIRE dans une session dédiée
Ton `.bashrc` **local** contient encore des secrets en clair (RUNPOD, HF, Supabase, tokens…). Le VPS est durci, mais ton PC reste le trésor. Procédure (même pattern que le VPS, ~20 min) :

```bash
# 1. Sauvegarde
cp -a ~/.bashrc ~/.bashrc.preaudit-$(date +%Y%m%d)
# 2. Dossier sécurisé + extraction de TOUTES les lignes export
mkdir -p ~/.config/secrets && chmod 700 ~/.config/secrets
umask 077
grep -E '^export [A-Za-z_][A-Za-z_0-9]*=' ~/.bashrc > ~/.config/secrets/env
# 3. Vérification syntaxe + sourcing sous set -u
bash -n ~/.config/secrets/env && bash -uc '. ~/.config/secrets/env && echo OK'
# 4. Retrait des exports du .bashrc + sourcing gardé
sed -i '/^export [A-Za-z_][A-Za-z_0-9]*=/d' ~/.bashrc
printf '\n# Secrets locaux (ne jamais versionner)\n[ -f ~/.config/secrets/env ] && . ~/.config/secrets/env\n' >> ~/.bashrc
chmod 600 ~/.bashrc ~/.config/secrets/env
# 5. Tester un NOUVEAU terminal (variables chargées) avant de fermer l'ancien
```

### 7.6 Hook PAM SSH — alerte Telegram si IP non autorisée

Un hook PAM (`/usr/local/bin/telegram-alert-ssh.sh`) envoie une alerte Telegram ("Louky") à chaque connexion SSH depuis une IP **non whitelistée**.

**Whitelist** : variable `SSH_ALERT_ALLOWED_IPS` dans `/etc/secrets/hermes.env` (600, root).
```bash
# Consulter
sudo grep SSH_ALERT_ALLOWED_IPS /etc/secrets/hermes.env
# Résultat : export SSH_ALERT_ALLOWED_IPS="REDACTED REDACTED"

# Mettre à jour (IP dynamique SFR — à refaire si tu changes de IP)
sudo sed -i 's/SSH_ALERT_ALLOWED_IPS=.*/SSH_ALERT_ALLOWED_IPS="ANCIENNE NOUVELLE"/' /etc/secrets/hermes.env
```

**Comment savoir si ton IP a changé** : tu reçois des notifications "Connexion SSH - IP non autorisee" alors que c'est toi qui te connectes. L'IP affichée dans la notification est la bonne — ajoute-la à la whitelist.

**Note** : ce hook est **indépendant** du firewall Contabo (WebExposure) et du UFW. C'est un monitoring interne au VPS.

Compléments : BitLocker activé sur le disque Windows (Panneau de configuration → Chiffrement de lecteur), 2FA sur Telegram + Google + GitHub, Kaspersky conservé + mises à jour Windows automatiques.
