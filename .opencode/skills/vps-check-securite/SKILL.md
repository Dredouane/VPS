---
name: vps-check-securite
description: >-
  Audit de non-régression sécurité du VPS nemo (REDACTED, SSH read-only) :
  sshd (port 2222, root/password désactivés, ciphers sans algo faible, drop-ins),
  UFW (default deny, 2222 ALLOW, 8642/8650 DENY, 22000 restreint, DOCKER-USER),
  Fail2ban (jail sshd), AIDE (base + cron aide-check-alert.sh + 99_custom),
  daemon.json Docker, secrets /etc/secrets/hermes.env (600), hook PAM SSH,
  sysctl durci, postfix loopback, snapd, unattended-upgrades, sudoers.
  Use when the user says "check sécurité", "vps-check-securite", "vérifier le
  hardening", "non-régression sécurité", "audit sécurité", or as part of
  vps-check-full.
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
| S8 | Forwards / DNS / X11 / empty pwd | `sudo sshd -T \| grep -Ei 'allowtcpforwarding\|allowagentforwarding\|usedns\|x11forwarding\|permitemptypasswords'` | `no` ×5 (usedns : `no`) |
| S9 | Ciphers/MACs sans algo faible | `sudo sshd -T \| grep -E '^(ciphers\|macs) '` | **0** occurrence de `arcfour`, `hmac-sha1`, `hmac-md5` (grep -cE → 0) ; AES-GCM ou ETM présent |
| S10 | Drop-ins SSH | `ls /etc/ssh/sshd_config.d/` | `00-hardening.conf` présent (le hardening inclus reste prioritaire) |
| S11 | Perms `.ssh` admin | `stat -c '%a' /home/admin/.ssh /home/admin/.ssh/authorized_keys` | `700` et `600` |

## Checks — Réseau / UFW / Docker

| # | Check | Commande | Attendu |
|---|---|---|---|
| S12 | UFW active | `sudo ufw status` | `Status: active` |
| S13 | Default policy | `sudo ufw status verbose` | `Default: deny (incoming)` |
| S14 | Règles ouvertes | `sudo ufw status \| grep -E '2222\|8642\|8650\|22000'` | `2222/tcp ALLOW` ; `8642/tcp DENY` ; `8650/tcp DENY` ; `22000/tcp ALLOW` **depuis REDACTED uniquement** |
| S15 | Bloc UFW/Docker | `grep -c 'BEGIN UFW AND DOCKER' /etc/ufw/after.rules` | ≥ 1 (bloc présent — critique : Docker court-circuite UFW) |
| S16 | Chaîne DOCKER-USER | `sudo iptables -L DOCKER-USER -n` | contient une règle `DROP` finale (RETURN RFC1918/loopback/ESTABLISHED tolérés) |
| S17 | daemon.json | `cat /etc/docker/daemon.json` | `no-new-privileges: true`, `live-restore: true`, log-opts `max-size 10m` / `max-file 3`, **aucune** clé `userns-remap` |

⚠️ UFW liste aussi des `REJECT` **dynamiques** (fail2ban) — ne jamais matcher
une liste figée complète de règles, uniquement les règles ci-dessus.

## Checks — Fail2ban & AIDE

| # | Check | Commande | Attendu |
|---|---|---|---|
| S18 | Service fail2ban | `systemctl is-active fail2ban` | `active` |
| S19 | Jail sshd | `sudo fail2ban-client status` (liste) + `grep -E '^(port\|bantime\|backend\|banaction)' /etc/fail2ban/jail.local` | jail `sshd` présente ; `port = 2222`, `bantime = 86400`, `backend = systemd`, `banaction = ufw` |
| S20 | Base AIDE | `stat -c '%a' /var/lib/aide/aide.db` | présente, `600` |
| S21 | Cron AIDE | `cat /etc/cron.d/aide` | planifié à 3h (`0 3 * * *`) appelant `/usr/local/bin/aide-check-alert.sh`, avec `%` **échappé** (`\%`) si log daté |
| S22 | Exclusions churn `99_custom` | `cat /etc/aide/aide.conf.d/99_custom` | contient : `node_modules` ( agents + global), `/var/lib/docker`, `containerd`, data-dirs `hermes-fleet/*/data`, `.hermes` des 3 users, `syncthing`, `fail2ban`, `landscape`, `/run/containerd` (grep par mot-clé, ≥ 8 motifs) |
| S23 | Dernier check AIDE | `ls -lt /var/log/aide/ \| head -3` | log récent (< 26 h) — si `found differences` dans le dernier log → `~ WARN` à investiguer (peut être légitime après changement volontaire) |

## Checks — Secrets & utilisateurs

| # | Check | Commande | Attendu |
|---|---|---|---|
| S24 | Perms /etc/secrets | `sudo stat -c '%a %U:%G' /etc/secrets /etc/secrets/hermes.env` | `700 root:root` et `600 root:root` |
| S25 | Sourcing valide | `sudo bash -uc '. /etc/secrets/hermes.env && echo OK'` | `OK`, pas d'`unbound variable` |
| S26 | Variables présentes (noms seuls) | `sudo grep -cE '^(DEEPSEEK_API_KEY\|ALERT_TELEGRAM_BOT_TOKEN\|ALERT_TELEGRAM_CHAT_ID\|SSH_ALERT_ALLOWED_IPS)=' /etc/secrets/hermes.env` | `4` — **ne jamais afficher les valeurs** |
| S27 | 0 export dans .bashrc | `sudo grep -c '^export' /root/.bashrc` + `sudo stat -c '%a' /root/.bashrc` | `0` et `600` |
| S28 | Tokens fleet | `sudo stat -c '%a' /root/.fleet_tokens.env` | `600` |
| S29 | Utilisateur ubuntu supprimé | `id ubuntu` | inexistant (rc≠0) |
| S30 | Sudoers durci | `ls /etc/sudoers.d/` | `90-admin` présent, `90-cloud-init-users` **absent** |
| S31 | Hook PAM SSH | `grep pam_exec /etc/pam.d/sshd` | contient `session optional pam_exec.so quiet seteuid /usr/local/bin/telegram-alert-ssh.sh` |
| S32 | Scripts d'alerte | `sudo stat -c '%a %U:%G' /usr/local/bin/telegram-alert.sh /usr/local/bin/telegram-alert-ssh.sh /usr/local/bin/aide-check-alert.sh` | `700 root:root` ×3 |

## Checks — Isolation système

| # | Check | Commande | Attendu |
|---|---|---|---|
| S33 | Postfix loopback | `grep ^inet_interfaces /etc/postfix/main.cf` + `sudo ss -tlnp \| grep ':25 '` | `loopback-only` ; écoute `127.0.0.1:25` et `[::1]:25` uniquement |
| S34 | snapd désactivé | `systemctl is-enabled snapd` + `is-active snapd` | `disabled` + `inactive` |
| S35 | sysctl durci (runtime) | `sysctl -n kernel.kptr_restrict kernel.dmesg_restrict kernel.perf_event_paranoid kernel.yama.ptrace_scope kernel.unprivileged_bpf_disabled` | `2`, `1`, `3`, `2`, `1` |
| S36 | Unattended-upgrades | `systemctl is-enabled unattended-upgrades` | `enabled` |

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
