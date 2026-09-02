#!/usr/bin/env bash
# backup-keys.sh — archive chiffrée des clés SSH privées (audit 2026-08-30)
# À lancer depuis le WSL LOCAL : bash ~/dev/VPS/Installation/scripts/backup-keys.sh
# La passphrase GPG est demandée en interactif (jamais visible par un agent).
# RITUEL : même passphrase que la clé SSH (celle du password manager).
set -euo pipefail

DEST="$HOME/backups/keys"
STAMP=$(date +%Y%m%d-%H%M%S)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DEST"
chmod 700 "$DEST"

# Clés privées + publiques + config SSH (contient IP/port, non sensible cryptographiquement)
cp ~/.ssh/id_ed25519 ~/.ssh/id_ed25519.pub "$TMP/" 2>/dev/null || true
cp ~/.ssh/REDACTED ~/.ssh/REDACTED.pub "$TMP/" 2>/dev/null || true
cp ~/.ssh/id_rsa ~/.ssh/id_rsa.pub "$TMP/" 2>/dev/null || true
cp ~/.ssh/config "$TMP/ssh_config" 2>/dev/null || true
chmod 600 "$TMP"/* 2>/dev/null || true

N=$(ls -1 "$TMP" | wc -l)
[ "$N" -ge 2 ] || { echo "ERREUR: aucune clé trouvée dans ~/.ssh"; exit 1; }

# Archive écrite HORS de $TMP (sinon tar se voit s'archiver lui-même → rc=1 avec set -e)
TARBALL="/tmp/keys-$STAMP.tar.gz"
tar -C "$TMP" -czf "$TARBALL" .
gpg --symmetric --cipher-algo AES256 --output "$DEST/keys-$STAMP.tar.gz.gpg" "$TARBALL"
rm -f "$TARBALL"
chmod 600 "$DEST/keys-$STAMP.tar.gz.gpg"

echo ""
echo "Archive créée : $DEST/keys-$STAMP.tar.gz.gpg ($N fichiers)"
echo ""
echo "RITUEL DE SÉCURITÉ :"
echo "  1. Copie ce fichier .gpg sur une clé USB (hors machine)"
echo "  2. Note la passphrase GPG (= passphrase de ta clé SSH) dans le password manager"
echo ""
echo "RESTAURATION (si besoin un jour) :"
echo "  gpg -d $DEST/keys-$STAMP.tar.gz.gpg | tar -xz -C /tmp/keys-restored/"
echo "  puis : cp /tmp/keys-restored/id_* ~/.ssh/ && chmod 600 ~/.ssh/id_*"
