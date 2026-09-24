# Plan de Blindage & Restauration Complet – VPS Ubuntu 22.04 LTS (Clean Plate)

**Objectif** : Transformer un VPS fraîchement ré-imagé en machine ultra-durcie, prête pour une flotte d’agents LLM (Hermes / LiteLLM), Syncthing, Vault Obsidian, sans jamais revoir de rootkit ou backdoor.

**Contexte source** :
- Guidelines SecOps 2026 (SSH, UFW+Docker, no-new-privileges, AIDE, secrets).
- Post X @QuentinLecocq_ (27 Aug 2026) : UFW + Fail2ban + utilisateur dédié **sans sudo** + versions figées + least privilege strict pour l’agent.
- Corrections critiques validées (post-incident) : pas de userns-remap, restauration d’archive, clé SSH réelle, gestion docker group, utilisateur/service Syncthing.

**Principe directeur** :
1. Least privilege absolu (utilisateur service sans sudo).
2. Surface d’attaque minimale.
3. Détection immédiate de toute altération de binaires.
4. Secrets jamais en clair dans les images ou variables d’environnement visibles.
5. Tout doit être idempotent et testable.
6. **Ne jamais casser les permissions des volumes partagés** (Obsidian, SQLite, Syncthing).

**Avertissement critique pour l’agent OpenCode** :
- Toujours garder **deux sessions SSH ouvertes** pendant les modifications SSH.
- Tester chaque changement critique avant de passer à l’étape suivante.
- Ne jamais exécuter `ufw enable` ou changer le port SSH sans avoir vérifié la connexion alternative.
- **Remplacer impérativement la variable `ADMIN_PUBKEY` par la vraie clé publique avant de désactiver les mots de passe.**
- En cas de doute → s’arrêter et demander confirmation humaine.

---

## 0. Prérequis & Variables (à définir AVANT exécution)

```bash
# ============================================================
# VARIABLES OBLIGATOIRES À ADAPTER
# ============================================================

ADMIN_USER="admin"                  # Utilisateur admin avec sudo
HERMES_USER="hermes"                # Utilisateur service SANS sudo
SSH_PORT="$VPS_SSH_PORT"                     # Port SSH non standard

# ⚠️⚠️⚠️ CRITIQUE – REMPLACER PAR TA VRAIE CLÉ PUBLIQUE ⚠️⚠️⚠️
# Si tu laisses la valeur placeholder, tu seras définitivement verrouillé hors du VPS
ADMIN_PUBKEY="ssh-ed25519 AAAA... REMPLACE_MOI_PAR_TA_VRAIE_CLE_PUBLIQUE"

TIMEZONE="Europe/Paris"

# Chemin de l’archive de backup (à adapter si besoin)
BACKUP_ARCHIVE="/root/vps_clean_backup.tar.gz"   # ou le chemin réel où se trouve l’archive
```

---

## 1. Première connexion & Mise à jour système

```bash
# En root
apt update && apt full-upgrade -y
apt autoremove -y
apt install -y curl wget git htop jq unzip ufw fail2ban unattended-upgrades apt-listchanges rsync
timedatectl set-timezone $TIMEZONE
```

Redémarrer si un nouveau kernel a été installé :
```bash
reboot
```

---

## 2. Création des utilisateurs (Least Privilege)

### 2.1 Utilisateur administrateur
```bash
adduser --disabled-password --gecos "" $ADMIN_USER
usermod -aG sudo $ADMIN_USER

# Ajouter l’alias syncthing dans le .bashrc d'admin
echo "alias sync-reset="syncthing-manage reset"" >> /home/$ADMIN_USER/.bashrc

mkdir -p /home/$ADMIN_USER/.ssh
echo "$ADMIN_PUBKEY" > /home/$ADMIN_USER/.ssh/authorized_keys
chmod 700 /home/$ADMIN_USER/.ssh
chmod 600 /home/$ADMIN_USER/.ssh/authorized_keys
chown -R $ADMIN_USER:$ADMIN_USER /home/$ADMIN_USER/.ssh
```

### 2.2 Utilisateur service Hermes (SANS sudo)
```bash
adduser --disabled-password --gecos "" $HERMES_USER
# NE PAS ajouter au groupe sudo
# NE PAS ajouter au groupe docker
mkdir -p /home/$HERMES_USER
chown -R $HERMES_USER:$HERMES_USER /home/$HERMES_USER
```

### 2.3 Utilisateur système Syncthing
```bash
adduser --system --group --home /home/syncthing syncthing
```

**Test obligatoire** : se connecter en `$ADMIN_USER` avec la clé SSH **avant** de continuer et surtout avant de désactiver l’authentification par mot de passe.

---

## 3. Hardening SSH (priorité absolue)

Créer le drop-in (préfixe bas pour primer sur cloud-init) :

```bash
cat > /etc/ssh/sshd_config.d/00-hardening.conf << EOF
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
LoginGraceTime 20
MaxSessions 3
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PermitEmptyPasswords no
AllowUsers $ADMIN_USER
EOF
```

Chiffres modernes :
```bash
cat > /etc/ssh/sshd_config.d/10-ciphers.conf << EOF
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,sntrup761x25519-sha512@openssh.com
Ciphers [email protected],[email protected],[email protected]
MACs [email protected],[email protected]
HostKeyAlgorithms ssh-ed25519,rsa-sha2-512,rsa-sha2-256
EOF
```

Valider et recharger :
```bash
sshd -t
systemctl reload ssh
```

**Test obligatoire** : ouvrir une **nouvelle** session sur le port `$SSH_PORT` avec la clé.  
Ne fermer l’ancienne session qu’après succès confirmé.

---

## 4. Fail2ban

```bash
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
banaction = ufw
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = $SSH_PORT
filter = sshd
backend = systemd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400
EOF

systemctl enable --now fail2ban
fail2ban-client status sshd
```

---

## 5. Pare-feu UFW + Gestion Docker

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow $SSH_PORT/tcp comment 'SSH hardened'
# Décommenter uniquement si besoin d’exposition publique
# ufw allow 80/tcp
# ufw allow 443/tcp
ufw --force enable
```

### Règles DOCKER-USER (critique – Docker court-circuite UFW)

Ajouter à la fin de `/etc/ufw/after.rules` :

```bash
cat >> /etc/ufw/after.rules << 'EOF'

# BEGIN UFW AND DOCKER
*filter
:DOCKER-USER - [0:0]
-A DOCKER-USER -j RETURN -s 10.0.0.0/8
-A DOCKER-USER -j RETURN -s 172.16.0.0/12
-A DOCKER-USER -j RETURN -s 192.168.0.0/16
-A DOCKER-USER -j RETURN -s 127.0.0.0/8
-A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
-A DOCKER-USER -j DROP
COMMIT
# END UFW AND DOCKER
EOF

ufw reload
```

**Règle d’or** : tous les conteneurs d’agents doivent publier leurs ports en `127.0.0.1:port:port` uniquement.

---

## 6. Installation & Hardening Docker

```bash
# Installation officielle Docker
curl -fsSL https://get.docker.com | sh

# Ajouter UNIQUEMENT l’utilisateur admin au groupe docker
usermod -aG docker $ADMIN_USER

# daemon.json sécurisé (PAS de "userns-remap")
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << EOF
{
  "no-new-privileges": true,
  "live-restore": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 65536,
      "Soft": 65536
    }
  }
}
EOF

systemctl restart docker
```

---

## 7. Installation & Configuration de Syncthing

```bash
# Installation de Syncthing
apt install -y syncthing

# Activation et démarrage du service pour l'utilisateur syncthing
systemctl enable syncthing@syncthing.service
systemctl start syncthing@syncthing.service
```

---

## 8. Restauration de l’archive de backup (CRITIQUE)

```bash
# 1. Créer un dossier temporaire de restauration
mkdir -p /tmp/restore
cd /tmp/restore

# 2. Extraire l’archive
tar -xzf "$BACKUP_ARCHIVE"

# 3. Restaurer les dossiers utilisateurs Hermes / agents
rsync -a /tmp/restore/home/hermesrunner/ /home/hermesrunner/ 2>/dev/null || true
rsync -a /tmp/restore/home/loukyrunner/ /home/loukyrunner/ 2>/dev/null || true
rsync -a /tmp/restore/home/hermes/ /home/hermes/ 2>/dev/null || true

# 4. Restaurer le Vault Obsidian pour Syncthing
mkdir -p /home/syncthing
rsync -a /tmp/restore/home/syncthing/obsidian-vault/ /home/syncthing/obsidian-vault/ 2>/dev/null || true
chown -R syncthing:syncthing /home/syncthing 2>/dev/null || true

# 5. Restaurer la configuration LiteLLM
mkdir -p /opt/litellm
cp /tmp/restore/opt/litellm/config.yaml /opt/litellm/config.yaml 2>/dev/null || true
chown -R root:root /opt/litellm

# 6. Restaurer le script spawn-agent
cp /tmp/restore/usr/local/bin/spawn-agent /usr/local/bin/spawn-agent 2>/dev/null || cp /tmp/restore/spawn-agent.sh /usr/local/bin/spawn-agent 2>/dev/null || true
chmod +x /usr/local/bin/spawn-agent

# 7. Restaurer les fichiers .hermes et bases SQLite si présents ailleurs
find /tmp/restore -name "*.hermes" -o -name "state.db" 2>/dev/null
```

---

## 9. Détection d’intégrité – AIDE

```bash
apt install -y aide
aideinit
cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db

echo "0 3 * * * root /usr/bin/aide --check > /var/log/aide/aide-\$(date +\%Y\%m\%d).log 2>&1" > /etc/cron.d/aide
mkdir -p /var/log/aide
```

---

## 10. Mises à jour automatiques de sécurité

```bash
dpkg-reconfigure -plow unattended-upgrades
```

---

## 11. Gestion des secrets (API keys)

```bash
mkdir -p /etc/secrets
chmod 700 /etc/secrets
chown root:root /etc/secrets/* 2>/dev/null || true
chmod 600 /etc/secrets/* 2>/dev/null || true
```

---

## 12. Kernel Hardening (sysctl)

```bash
cat > /etc/sysctl.d/99-hardening.conf << EOF
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.perf_event_paranoid = 3
kernel.unprivileged_bpf_disabled = 1
kernel.yama.ptrace_scope = 2
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.tcp_syncookies = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
EOF

sysctl --system
```

---

## 13. Nettoyage final & Vérifications

```bash
systemctl disable --now snapd 2>/dev/null || true

echo "=== SSH Config ==="
sshd -T | grep -E 'passwordauthentication|permitrootlogin|port'

echo "=== UFW Status ==="
ufw status verbose

echo "=== Fail2ban ==="
fail2ban-client status sshd

echo "=== Docker Security ==="
docker info 2>/dev/null | grep -E 'Security Options|userns' || true

echo "=== Syncthing Status ==="
systemctl status syncthing@syncthing.service --no-pager

echo "=== AIDE ==="
aide --check 2>&1 | head -20 || true
```
