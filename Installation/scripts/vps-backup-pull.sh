#!/usr/bin/env bash
# vps-backup-pull.sh v2 — rapatrie la DERNIÈRE archive de sauvegarde du VPS nemo
# Clé dédiée id_vps_backup (sans passphrase, restreinte côté serveur par
# restrict + commande forcée : ne peut QUE streamer la dernière archive).
# => Fonctionne sans agent SSH, donc depuis une tâche planifiée Windows.
#
# Comportement v2 (06-07/09/2026) :
#   - garde 4 sauvegardes DATÉES sur le PC (~5 Go) + fleet-latest.tar.gz (lien)
#   - téléchargement en .part, renommé SEULEMENT si l'archive est intègre
#   - timeout global 30 min + détection de connexion morte
#   - 1 retry automatique ; tout est journalisé dans pull.log
set -euo pipefail

DEST="$HOME/backups/vps-fleet"
LOG="$DEST/pull.log"
KEEP=4                 # nombre d'archives datées conservées localement
MAXSECS=1800           # timeout global du transfert (30 min)
PART="$DEST/.part.tar.gz"

mkdir -p "$DEST"
chmod 700 "$DEST"

log() { echo "$(date '+%F %T') $*" | tee -a "$LOG"; }

pull_once() {
  : > "$PART"
  timeout "$MAXSECS" ssh -o BatchMode=yes -o ConnectTimeout=20 \
    -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
    nemo-backup > "$PART" 2>/dev/null
}

fetch() {
  if pull_once; then
    if gzip -t "$PART" 2>/dev/null; then
      return 0
    fi
    log "ECHEC: archive corrompue (tentative 1) — retry"
    pull_once || return 1
    gzip -t "$PART" 2>/dev/null
  fi
}

# --- Téléchargement + intégrité (2 tentatives max) ---
if fetch; then
  D=$(date +%Y%m%d)
  OUT="$DEST/fleet-$D.tar.gz"
  mv "$PART" "$OUT"
  chmod 600 "$OUT"
  ln -sf "$(basename "$OUT")" "$DEST/fleet-latest.tar.gz"
  # Rétention locale : garder les $KEEP archives datées les plus récentes
  ls -1t "$DEST"/fleet-2*.tar.gz 2>/dev/null | tail -n +$((KEEP+1)) | while read -r old; do
    rm -f "$old"
    log "retention: suppression $(basename "$old")"
  done
  log "OK: $OUT ($(du -h "$OUT" | cut -f1))"
else
  rm -f "$PART"
  log "ECHEC: pull impossible ou corrompu après retry"
  exit 1
fi
