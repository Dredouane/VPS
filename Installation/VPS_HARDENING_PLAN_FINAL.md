# Complete Hardening & Restoration Plan – Ubuntu 22.04 LTS VPS (Clean Plate)

**Objective**: Transform a freshly re-imaged VPS into an ultra-hardened machine, ready for a fleet of LLM agents (Hermes / LiteLLM), Syncthing, an Obsidian vault, without ever seeing a rootkit or backdoor again.

**Source context**:
- 2026 SecOps guidelines (SSH, UFW+Docker, no-new-privileges, AIDE, secrets).
- X post by @QuentinLecocq_ (27 Aug 2026): UFW + Fail2ban + dedicated user **without sudo** + pinned versions + strict least privilege for the agent.
- Validated critical fixes (post-incident): no userns-remap, archive restoration, real SSH key, docker group handling, Syncthing user/service.

**Guiding principles**:
1. Absolute least privilege (service user without sudo).
2. Minimal attack surface.
3. Immediate detection of any binary alteration.
4. Secrets never in plaintext in images or visible environment variables.
5. Everything must be idempotent and testable.
6. **Never break the permissions of shared volumes** (Obsidian, SQLite, Syncthing).

**Critical warning for the OpenCode agent**:
- Always keep **two SSH sessions open** during SSH changes.
- Test every critical change before moving to the next step.
- Never run `ufw enable` or change the SSH port without having verified the alternative connection.
- **Imperatively replace the `ADMIN_PUBKEY` variable with the real public key before disabling passwords.**
- When in doubt → stop and ask for human confirmation.

---

## 0. Prerequisites & Variables (to define BEFORE execution)

```bash
# ============================================================
# MANDATORY VARIABLES TO ADAPT
# ============================================================

ADMIN_USER="admin"                  # Admin user with sudo
HERMES_USER="hermes"                # Service user WITHOUT sudo
SSH_PORT="$VPS_SSH_PORT"                     # Non-standard SSH port

# ⚠️⚠️⚠️ CRITICAL – REPLACE WITH YOUR REAL PUBLIC KEY ⚠️⚠️⚠️
# If you leave the placeholder value, you will be permanently locked out of the VPS
ADMIN_PUBKEY="ssh-ed25519 AAAA... REPLACE_ME_WITH_YOUR_REAL_PUBLIC_KEY"

TIMEZONE="Europe/Paris"

# Path of the backup archive (adapt if needed)
BACKUP_ARCHIVE="/root/vps_clean_backup.tar.gz"   # or the actual path where the archive is located
```

---

## 1. First Connection & System Update

```bash
# As root
apt update && apt full-upgrade -y
apt autoremove -y
apt install -y curl wget git htop jq unzip ufw fail2ban unattended-upgrades apt-listchanges rsync
timedatectl set-timezone $TIMEZONE
```

Reboot if a new kernel was installed:
```bash
reboot
```

---

## 2. User Creation (Least Privilege)

### 2.1 Administrator user
```bash
adduser --disabled-password --gecos "" $ADMIN_USER
usermod -aG sudo $ADMIN_USER

# Add the syncthing alias to admin's .bashrc
echo "alias sync-reset="syncthing-manage reset"" >> /home/$ADMIN_USER/.bashrc

mkdir -p /home/$ADMIN_USER/.ssh
echo "$ADMIN_PUBKEY" > /home/$ADMIN_USER/.ssh/authorized_keys
chmod 700 /home/$ADMIN_USER/.ssh
chmod 600 /home/$ADMIN_USER/.ssh/authorized_keys
chown -R $ADMIN_USER:$ADMIN_USER /home/$ADMIN_USER/.ssh
```

### 2.2 Hermes service user (WITHOUT sudo)
```bash
adduser --disabled-password --gecos "" $HERMES_USER
# DO NOT add to the sudo group
# DO NOT add to the docker group
mkdir -p /home/$HERMES_USER
chown -R $HERMES_USER:$HERMES_USER /home/$HERMES_USER
```

### 2.3 Syncthing system user
```bash
adduser --system --group --home /home/syncthing syncthing
```

**Mandatory test**: log in as `$ADMIN_USER` with the SSH key **before** continuing and above all before disabling password authentication.

---

## 3. SSH Hardening (absolute priority)

Create the drop-in (low prefix so it takes precedence over cloud-init):

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

Modern ciphers:
```bash
cat > /etc/ssh/sshd_config.d/10-ciphers.conf << EOF
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,sntrup761x25519-sha512@openssh.com
Ciphers [email protected],[email protected],[email protected]
MACs [email protected],[email protected]
HostKeyAlgorithms ssh-ed25519,rsa-sha2-512,rsa-sha2-256
EOF
```

Validate and reload:
```bash
sshd -t
systemctl reload ssh
```

**Mandatory test**: open a **new** session on port `$SSH_PORT` with the key.  
Only close the old session after confirmed success.

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

## 5. UFW Firewall + Docker Handling

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow $SSH_PORT/tcp comment 'SSH hardened'
# Uncomment only if public exposure is needed
# ufw allow 80/tcp
# ufw allow 443/tcp
ufw --force enable
```

### DOCKER-USER rules (critical – Docker short-circuits UFW)

Append at the end of `/etc/ufw/after.rules`:

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

**Golden rule**: all agent containers must publish their ports as `127.0.0.1:port:port` only.

---

## 6. Docker Installation & Hardening

```bash
# Official Docker installation
curl -fsSL https://get.docker.com | sh

# Add ONLY the admin user to the docker group
usermod -aG docker $ADMIN_USER

# Secure daemon.json (NO "userns-remap")
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

## 7. Syncthing Installation & Configuration

```bash
# Syncthing installation
apt install -y syncthing

# Enable and start the service for the syncthing user
systemctl enable syncthing@syncthing.service
systemctl start syncthing@syncthing.service
```

---

## 8. Backup Archive Restoration (CRITICAL)

```bash
# 1. Create a temporary restore folder
mkdir -p /tmp/restore
cd /tmp/restore

# 2. Extract the archive
tar -xzf "$BACKUP_ARCHIVE"

# 3. Restore the Hermes / agent user folders
rsync -a /tmp/restore/home/hermesrunner/ /home/hermesrunner/ 2>/dev/null || true
rsync -a /tmp/restore/home/loukyrunner/ /home/loukyrunner/ 2>/dev/null || true
rsync -a /tmp/restore/home/hermes/ /home/hermes/ 2>/dev/null || true

# 4. Restore the Obsidian Vault for Syncthing
mkdir -p /home/syncthing
rsync -a /tmp/restore/home/syncthing/obsidian-vault/ /home/syncthing/obsidian-vault/ 2>/dev/null || true
chown -R syncthing:syncthing /home/syncthing 2>/dev/null || true

# 5. Restore the LiteLLM configuration
mkdir -p /opt/litellm
cp /tmp/restore/opt/litellm/config.yaml /opt/litellm/config.yaml 2>/dev/null || true
chown -R root:root /opt/litellm

# 6. Restore the spawn-agent script
cp /tmp/restore/usr/local/bin/spawn-agent /usr/local/bin/spawn-agent 2>/dev/null || cp /tmp/restore/spawn-agent.sh /usr/local/bin/spawn-agent 2>/dev/null || true
chmod +x /usr/local/bin/spawn-agent

# 7. Restore .hermes files and SQLite databases if present elsewhere
find /tmp/restore -name "*.hermes" -o -name "state.db" 2>/dev/null
```

---

## 9. Integrity Detection – AIDE

```bash
apt install -y aide
aideinit
cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db

echo "0 3 * * * root /usr/bin/aide --check > /var/log/aide/aide-\$(date +\%Y\%m\%d).log 2>&1" > /etc/cron.d/aide
mkdir -p /var/log/aide
```

---

## 10. Automatic Security Updates

```bash
dpkg-reconfigure -plow unattended-upgrades
```

---

## 11. Secrets Handling (API keys)

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

## 13. Final Cleanup & Checks

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
