---
name: vps-check-securite
description: >-
  Audit de non-régression sécurité du VPS nemo (REDACTED, SSH read-only) :
  sshd (port 2222, root/password désactivés, ciphers sans algo faible, drop-ins),
  UFW (default deny, 2222 seul port ouvert, 8642/8650 DENY, 22000 FERMÉ,
  DOCKER-USER), Fail2ban (jail sshd), AIDE (base + cron aide-check-alert.sh +
  99_custom), sauvegardes quotidiennes (vps-backup.sh), Tailscale (enrôlement),
  daemon.json Docker, secrets /etc/secrets/hermes.env (600), hook PAM SSH
  (allowlist IP), sysctl durci, postfix loopback, snapd, unattended-upgrades,
  sudoers. Use when the user says "check sécurité", "vps-check-securite",
  "vérifier le hardening", "non-régression sécurité", "audit sécurité", or as
  part of vps-check-full.
---

# Check sécurité — audit hardening VPS (SSH read-only)

Audit **lecture seule** du VPS `nemo` (admin@REDACTED:2222, clé
`REDACTED` via `~/.ssh/config`), baseline = état validé du 30/08/2026
(`Installation/RAPPORT_AUDIT_2026-08-30.md` §1 + §5).
Règles absolues :

1. **READ-ONLY strict** : interdits côté serveur — `rm`, `sed -i`,
   `systemctl restart/enable/disable/reset-failed`, `ufw allow/deny/delete`,
   `fail2ban-client` (action), `aideinit`, `setfacl`, `chmod/chown`, `userdel`,
   et toute écriture de fichier. Le skill rapporte, il ne corrige jamais.
2. **Aucun secret affiché** : valeurs de `hermes.env`, tokens, clés → jamais
   dans la sortie. Vérifier par **comptage** (`grep -c`) ou présence (`test -n`).
3. Sortie : tableau `| Check | Statut | Détail |` avec `✓ PASS` / `✗ FAIL` /
   `~ WARN` / `⏭ SKIP` + verdict global (SAIN / ACTION REQUISE).
4. FAIL → orienter vers la remédiation (§Remédiation), ne rien appliquer.

## Connexion

```bash
SSH="ssh -o BatchMode=yes -o ConnectTimeout=8 nemo"
```

Sonde préalable : `$SSH 'echo ok'` → si échec (timeout, clé refusée) :
**tous les checks S1-S30 = SKIP**, conclure le rapport avec la note
« VPS non joignable — checks distants ignorés ».

Les checks R1-R4 (repo local) ne dépendent pas du SSH — cf. skill
`vps-check-repo` pour les exécuter en parallèle.

## Checks — SSH (serveur)

| # | Check | Commande (`$SSH '…'`) | Attendu (baseline 30/08) |
|---|---|---|---|
| S1 | Port SSH | `sudo ss -tlnp \| grep sshd` | `0.0.0.0:2222` + `[::]:2222` uniquement, **pas de `:22`** |
| S2 | PermitRootLogin | `sudo sshd -T \| grep -i permitrootlogin` | `no` |
| S3 | PasswordAuthentication | `sudo sshd -T \| grep -i passwordauthentication` | `no` |
| S4 | KbdInteractiveAuthentication | `sudo sshd -T \| grep -i kbdinteractiveauthentication` | `no` |
| S5 | PubkeyAuthentication | `sudo sshd -T \| grep -i pubkeyauthentication` | `yes` |
| S6 | AuthenticationMethods | `sudo sshd -T \| grep -i authenticationmethods` | `publickey` |
| S7 | MaxAuthTries | `sudo sshd -T \| grep -i maxauthtries` | `3` |
| S8 | Forwards / DNS / X11 / empty pwd | `sudo sshd -T \| grep -Ei 'allowtcpforwarding\|allowagentforwarding\|usedns\|x11forwarding\|permitemptypasswords'` | `allowtcpforwarding local` (intentionnel : `10-tunnel.conf`, tunnels `nemoclaw-tunnel` — ⚠️ le §1.1 du RAPPORT_AUDIT dit « no » à tort) ; `allowagentforwarding no`, `usedns no`, `x11forwarding no`, `permitemptypasswords no` |
| S9 | Ciphers/MACs sans algo faible | `sudo sshd -T \| grep -E '^(ciphers\|macs) '` | **0** occurrence de `arcfour`, `hmac-sha1`, `hmac-md5` (grep -cE → 0) ; `chacha20-poly1305@openssh.com` autorisé (moderne), AES-GCM + hmac-sha2-ETM présents |
| S10 | Drop-ins SSH | `ls /etc/ssh/sshd_config.d/` | `00-hardening.conf` présent (chargé en 1ᵉʳ → first-match-wins) ; drop-ins cloud-init résiduels tolérés (`50-cloud-init.conf` contient `PasswordAuthentication yes` **inerte** — neutralisé par sshd -T ; `60-cloudimg-settings.conf` = `no`) → `~ WARN` documentaire (prolonge Y2) |
| S11 | Perms `.ssh` admin | `stat -c '%a' /home/admin/.ssh /home/admin/.ssh/authorized_keys` | `700` et `600` |

## Checks — Réseau / UFW / Docker

| # | Check | Commande | Attendu |
|---|---|---|---|
| S12 | UFW active | `sudo ufw status` | `Status: active` |
| S13 | Default policy | `sudo ufw status verbose` | `Default: deny (incoming)` |
| S14 | Règles ouvertes | `sudo ufw status \| grep -E '2222\|8642\|8650\|22000'` | `2222/tcp ALLOW` ; `8642/tcp DENY` ; `8650/tcp DENY` ; **22000 : AUCUNE règle** (fermé le 01/09 — remplacé par Tailscale, cf. `EXPLICATION_SECURITE.md` §7.3) — une règle 22000 ALLOW résiduelle = **FAIL** |
| S15 | Bloc UFW/Docker | `sudo grep -c 'BEGIN UFW AND DOCKER' /etc/ufw/after.rules` | ≥ 1 (bloc présent — critique : Docker court-circuite UFW) |
| S16 | Chaîne DOCKER-USER | `sudo iptables -L DOCKER-USER -n` | contient une règle `DROP` finale (RETURN RFC1918/loopback/ESTABLISHED tolérés) |
| S17 | daemon.json | `cat /etc/docker/daemon.json` | `no-new-privileges: true`, `live-restore: true`, log-opts `max-size 10m` / `max-file 3`, **aucune** clé `userns-remap` |

⚠️ UFW liste aussi des `REJECT` **dynamiques** (fail2ban) — ne jamais matcher
une liste figée complète de règles, uniquement les règles ci-dessus.

## Checks — Fail2ban & AIDE

| # | Check | Commande | Attendu |
|---|---|---|---|
| S18 | Service fail2ban | `systemctl is-active fail2ban` | `active` |
| S19 | Jail sshd | `sudo fail2ban-client status` (liste) + `sudo fail2ban-client get sshd bantime` + `sudo grep -E '^(port\|bantime\|backend\|banaction)' /etc/fail2ban/jail.local` | jail `sshd` présente ; bantime **effectif** `86400` ; `port = 2222`, `backend = systemd`, `banaction = ufw` — un `bantime = 3600` en tête ([DEFAULT]) est toléré si la section [sshd] prime |
| S20 | Base AIDE | `stat -c '%a' /var/lib/aide/aide.db` | présente, `600` |
| S21 | Cron AIDE (heartbeat 🟢/🚨) | `cat /etc/cron.d/aide` + `sudo head -5 /usr/local/bin/aide-check-alert.sh` | planifié à 3h (`0 3 * * *`) appelant `/usr/local/bin/aide-check-alert.sh` (v4+) : chaque check envoie sur Telegram **🟢 OK** (0 diff ou diffs bénins via triage LLM) ou **🚨 NOK** (diffs suspects + explications) ; fallback brut si l'API LLM échoue ; détails complets dans `/var/log/aide/` (conservés 7 j, purge cron 5h) |
| S22 | Exclusions churn `99_custom` | `cat /etc/aide/aide.conf.d/99_custom` | contient : `node_modules` (agents + global), `/var/lib/docker`, `containerd`, data-dirs `hermes-fleet/.*/data` (récursif — instances pro incluses), `.hermes` des 3 users (ou pattern `admin\|hermesrunner\|arev`), `syncthing`, `fail2ban`, `landscape`, `/run/containerd`, `/run/docker`, `/var/lib/aide`, `/var/lib/tailscale`, `/var/backups`, `obsidian-vault`, `/var/cache/apt`, `/var/cache/motd-news`, `/var/lib/apt`, `/var/lib/ubuntu-advantage`, `/var/lib/update-notifier`, `/var/lib/update-manager`, `/var/lib/ubuntu-release-upgrader`, `/var/lib/systemd/timers`, `/run/systemd`, `/run/user`, `/run/ufw.lock`, `/swapfile` (grep par mot-clé, ≥ 15 motifs) |
| S23 | Dernier check AIDE | `ls -lt /var/log/aide/ \| head -3` | log récent (< 26 h), logs conservés **7 jours** (purge cron 5h) — si `found differences` dans le dernier log → `~ WARN` à investiguer (peut être légitime après changement volontaire ou fenêtre de déploiement Doer — cf. protocole §5.5) |

## Checks — Secrets & utilisateurs

| # | Check | Commande | Attendu |
|---|---|---|---|
| S24 | Perms /etc/secrets | `sudo stat -c '%a %U:%G' /etc/secrets /etc/secrets/hermes.env` | `700 root:root` et `600 root:root` |
| S25 | Sourcing valide | `sudo bash -uc '. /etc/secrets/hermes.env && echo OK'` | `OK`, pas d'`unbound variable` |
| S26 | Variables présentes (noms seuls) | `sudo grep -cE '^[[:space:]]*(export[[:space:]]+)?(DEEPSEEK_API_KEY\|ALERT_TELEGRAM_BOT_TOKEN\|ALERT_TELEGRAM_CHAT_ID\|SSH_ALERT_ALLOWED_IPS)=' /etc/secrets/hermes.env` | `4` — les lignes sont au format `export VAR=…` (migration §5.1) ; **ne jamais afficher les valeurs** |
| S27 | 0 export dans .bashrc | `sudo grep -c '^export' /root/.bashrc` + `sudo stat -c '%a' /root/.bashrc` | `0` et `600` |
| S28 | Tokens fleet | `sudo stat -c '%a' /root/.fleet_tokens.env` | `600` |
| S29 | Utilisateur ubuntu supprimé | `id ubuntu` | inexistant (rc≠0) |
| S30 | Sudoers durci | `sudo ls /etc/sudoers.d/` | `90-admin` présent, `90-cloud-init-users` **absent** |
| S31 | Hook PAM SSH | `grep pam_exec /etc/pam.d/sshd` | contient `session optional pam_exec.so quiet seteuid /usr/local/bin/telegram-alert-ssh.sh` |
| S32 | Scripts d'alerte | `sudo stat -c '%a %U:%G' /usr/local/bin/telegram-alert.sh /usr/local/bin/telegram-alert-ssh.sh /usr/local/bin/aide-check-alert.sh` | `700 root:root` ×3 |

## Checks — Isolation système

| # | Check | Commande | Attendu |
|---|---|---|---|
| S33 | Postfix loopback | `grep ^inet_interfaces /etc/postfix/main.cf` + `sudo ss -tlnp \| grep ':25 '` | `loopback-only` ; écoute `127.0.0.1:25` et `[::1]:25` uniquement |
| S34 | snapd désactivé | `systemctl is-enabled snapd` + `is-active snapd` | `disabled` + `inactive` |
| S35 | sysctl durci (runtime) | `sysctl -n kernel.kptr_restrict kernel.dmesg_restrict kernel.perf_event_paranoid kernel.yama.ptrace_scope kernel.unprivileged_bpf_disabled` | `2`, `1`, `3`, `2`, `1` |
| S36 | Unattended-upgrades | `systemctl is-enabled unattended-upgrades` | `enabled` |

## Checks — Sauvegardes & Tailscale (01/09/2026)

| # | Check | Commande | Attendu |
|---|---|---|---|
| S37 | Sauvegarde quotidienne | `ls -la /etc/cron.d/vps-backup` + `cat /etc/cron.d/vps-backup` + `sudo stat -c '%a %U:%G' /usr/local/bin/vps-backup.sh` + `ls -1t /var/backups/vps-fleet/fleet-*.tar.gz \| head -1` (mtime < 26 h) + `tail -3 /var/log/vps-backup.log` | cron `30 4 * * * root` ; script `700 root:root` ; archive récente 600 ; log sans erreur |
| S38 | Tailscale enrôlé | `systemctl is-active tailscaled` + `sudo tailscale status \| head -2` + `sudo tailscale ip -4` | `active` ; ligne du serveur `REDACTED` logged-in ; IP **REDACTED** |
| S39 | Clé backup restreinte | `sudo grep backup-pull-nemo /home/admin/.ssh/authorized_keys` + `stat -c '%a' /usr/local/bin/vps-backup-serve.sh` + `sudo ls ~/.ssh/id_vps_backup 2>&1` | ligne `restrict,command="/usr/local/bin/vps-backup-serve.sh"` présente ; script `755` ; clé privée **ABSENTE du serveur** (elle n'existe que sur le PC local — FAIL si trouvée) |

## Rapport

1. Tableau final `| Check | Statut | Détail |` groupé par domaine
   (SSH, UFW/Docker, Fail2ban/AIDE, Secrets/Utilisateurs, Isolation).
2. Interpréter chaque FAIL (quel point de la baseline du 30/08 a dérivé).
3. Verdict global : **SAIN** si 0 FAIL, sinon **ACTION REQUISE**.
4. Rappel : signaler les régressions, ne rien corriger.

## Remédiation (en cas de FAIL)

| Domaine | Référence |
|---|---|
| SSH (S1-S11) | `Installation/DOCUMENTATION_VPS.md` §3 (Sécurité/Hardening) + `Installation/VPS_HARDENING_PLAN_FINAL.md` §3 |
| UFW/Docker (S12-S17) | `Installation/DOCUMENTATION_VPS.md` §3 + `Installation/VPS_HARDENING_PLAN_FINAL.md` §5-§6 (règles DOCKER-USER, daemon.json) |
| Fail2ban (S18-S19) | `Installation/VPS_HARDENING_PLAN_FINAL.md` §4 |
| AIDE (S20-S23) | `Installation/RAPPORT_AUDIT_2026-08-30.md` §5.5 (exclusions churn, régénération base) + `DOCUMENTATION_VPS.md` §3 |
| Secrets/utilisateurs (S24-S30) | `Installation/RAPPORT_AUDIT_2026-08-30.md` §5.1 (R1/R2 : migration /etc/secrets, suppression ubuntu) |
| Supervision/PAM (S31-S32) | `Installation/RAPPORT_AUDIT_2026-08-30.md` §5.5 |
| Isolation (S33-S36) | `Installation/RAPPORT_AUDIT_2026-08-30.md` §1.5 + `DOCUMENTATION_VPS.md` §6 (TO DO Sécurité) |
| Sauvegardes/Tailscale/clé backup (S37-S39) | `Installation/EXPLICATION_SECURITE.md` §4 (points 2-3-4) + §7 (procédures) |
