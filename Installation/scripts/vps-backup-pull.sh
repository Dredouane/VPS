#!/usr/bin/env bash
# vps-backup-pull.sh — rapatrie la DERNIÈRE archive de sauvegarde du VPS nemo
# Clé dédiée id_vps_backup (sans passphrase, restreinte côté serveur par
# restrict + commande forcée : ne peut QUE streamer la dernière archive).
# => Fonctionne sans agent SSH, donc depuis une tâche planifiée Windows.
set -euo pipefail

DEST="$HOME/backups/vps-fleet"
OUT="$DEST/fleet-latest.tar.gz"
mkdir -p "$DEST"
chmod 700 "$DEST"

ssh -o BatchMode=yes -o ConnectTimeout=20 nemo-backup > "$OUT" 2>/dev/null
chmod 600 "$OUT"

if ! gzip -t "$OUT" 2>/dev/null; then
  echo "$(date '+%F %T') ERREUR: archive corrompue" >&2
  exit 1
fi
echo "$(date '+%F %T') OK: $OUT ($(du -h "$OUT" | cut -f1))"
