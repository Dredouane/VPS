#!/usr/bin/env bash
# vps-nightly-check.sh — check non-régression nocturne du VPS nemo (06/09/2026)
# Verdict Telegram condensé : 🟢 OK ou 🚨 NOK par domaine. Cron : 5h30.
# READ-ONLY. Détails : /var/log/aide/ (AIDE), /var/log/vps-backup.log (backup).
set -u
R=""
FAILS=0
ok()  { R="$R
🟩 $1"; }
bad() { R="$R
🟥 $1"; FAILS=$((FAILS+1)); }

# 1) Services systemd critiques
ACT=$(systemctl is-active hermes-gateway-hermesrunner hermes-gateway-arev tailscaled fail2ban docker syncthing@syncthing 2>/dev/null | paste -sd,)
[ "$ACT" = "active,active,active,active,active,active" ] && ok "Services systemd : tous actifs" || bad "Services systemd : [$ACT]"

# 2) Gateways natifs enabled
EN=$(systemctl is-enabled hermes-gateway-hermesrunner hermes-gateway-arev 2>/dev/null | paste -sd,)
[ "$EN" = "enabled,enabled" ] && ok "Gateways natifs : enabled (boot)" || bad "Gateways natifs enabled : [$EN]"

# 3) Conteneurs hermes up (4 legacy + 1 pro)
N=$(docker ps --filter name=hermes- --format '{{.Names}}' 2>/dev/null | wc -l)
[ "$N" -ge 5 ] && ok "Conteneurs hermes : $N up" || bad "Conteneurs hermes up : $N (attendu >= 5)"

# 4) Agents Telegram connectés (6)
C=0
for f in /home/admin/hermes-fleet/leanConstruction/data/gateway_state.json \
         /home/admin/hermes-fleet/copycat/data/gateway_state.json \
         /home/admin/hermes-fleet/aquisition/data/gateway_state.json \
         /home/admin/hermes-fleet/va_agent/data/gateway_state.json \
         /home/hermesrunner/.hermes/gateway_state.json \
         /home/arev-chantier-runner/.hermes/gateway_state.json; do
  grep -q '"state":"connected"' "$f" 2>/dev/null && C=$((C+1))
done
[ "$C" -eq 6 ] && ok "Agents Telegram : 6/6 connectés" || bad "Agents Telegram connectés : $C/6"

# 5) UFW : actif, 2222 ouvert, 22000 absent
ufw status 2>/dev/null | grep -q "Status: active" && ok "UFW : actif" || bad "UFW : inactif !"
ufw status 2>/dev/null | grep -q "2222/tcp" && ok "UFW : 2222 ALLOW" || bad "UFW : règle 2222 absente !"
if ufw status 2>/dev/null | grep -q "22000"; then bad "UFW : règle 22000 résiduelle (doit être fermée)"; else ok "UFW : 22000 fermé"; fi

# 6) Tailscale
TS=$(tailscale ip -4 2>/dev/null | head -1)
[ "$TS" = "REDACTED" ] && ok "Tailscale : enrôlé (REDACTED)" || bad "Tailscale : [$TS]"

# 7) Sauvegarde récente (< 26 h)
B=$(ls -1t /var/backups/vps-fleet/fleet-*.tar.gz 2>/dev/null | head -1)
if [ -n "$B" ]; then
  AGE=$(( ($(date +%s) - $(stat -c %Y "$B")) / 3600 ))
  [ "$AGE" -le 26 ] && ok "Backup : récent (${AGE}h)" || bad "Backup : trop ancien (${AGE}h)"
else
  bad "Backup : aucune archive"
fi

# 8) AIDE : check récent (< 26 h)
A=$(ls -1t /var/log/aide/aide-2*.log 2>/dev/null | head -1)
if [ -n "$A" ]; then
  AGE=$(( ($(date +%s) - $(stat -c %Y "$A")) / 3600 ))
  [ "$AGE" -le 26 ] && ok "AIDE : check récent (${AGE}h)" || bad "AIDE : dernier check trop ancien (${AGE}h)"
else
  bad "AIDE : aucun log de check"
fi

# 9) Swap actif
swapon --show 2>/dev/null | grep -q swap && ok "Swap : actif" || bad "Swap : absent !"

# 10) Disque racine < 90%
U=$(df --output=pcent / 2>/dev/null | tail -1 | tr -dc 0-9)
[ -n "$U" ] && [ "$U" -le 90 ] && ok "Disque / : $U% utilisé" || bad "Disque / : ${U}% (>= 90%)"

# 11) Units systemd failed
F=$(systemctl --failed --no-legend 2>/dev/null | wc -l)
[ "$F" -eq 0 ] && ok "Units systemd failed : 0" || bad "Units systemd failed : $F"

# Verdict
if [ "$FAILS" -eq 0 ]; then
  T="🟢 Nightly OK — non-régression saine"
else
  T="🚨 Nightly NOK — $FAILS problème(s)"
fi
/usr/local/bin/telegram-alert.sh "$T" "$R"
exit 0
