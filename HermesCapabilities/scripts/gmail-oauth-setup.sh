#!/usr/bin/env bash
# gmail-oauth-setup.sh — Setup OAuth Gmail pour la capability email-gmail.
# À exécuter PAR LE PROPRIÉTAIRE de la boîte (pattern offline + consent).
#
# Prérequis (Google Cloud Console) :
#   1. Projet → activer "Gmail API"
#   2. Écran de consentement : app type Interne ou Test (users de test = owner)
#   3. Credentials → OAuth client ID → type "Application Desktop"
#   4. Dans le client OAuth → "Authorized redirect URIs" → AJOUTER :
#      http://127.0.0.1:8765
#
# Usage:
#   ./gmail-oauth-setup.sh --client-id XXX --client-secret YYY
#   (ou env GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET)
#
# Sortie : GMAIL_REFRESH_TOKEN à placer dans client.env (600) / bashrc local.
# Les credentials ne sont jamais écrits dans un fichier par ce script.
set -euo pipefail

CID="${GMAIL_CLIENT_ID:-}"; CSEC="${GMAIL_CLIENT_SECRET:-}"
prev=""
for a in "$@"; do
    if [ "$prev" = "--client-id" ]; then CID="$a"; prev=""; continue; fi
    if [ "$prev" = "--client-secret" ]; then CSEC="$a"; prev=""; continue; fi
    case "$a" in
        --client-id) prev="--client-id" ;;
        --client-secret) prev="--client-secret" ;;
        -h|--help) grep '^#' "$0" | head -12; exit 0 ;;
    esac
done
[ -n "$CID" ] && [ -n "$CSEC" ] || { echo "Requis: GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET (env) ou --client-id/--client-secret"; exit 1; }

REDIRECT="http://127.0.0.1:8765"
SCOPE="https://www.googleapis.com/auth/gmail.modify"
AUTH_URL="https://accounts.google.com/o/oauth2/v2/auth?client_id=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$CID")&redirect_uri=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$REDIRECT'))")&response_type=code&scope=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$SCOPE'))")&access_type=offline&prompt=consent"

echo "════════════════════════════════════════════════════════"
echo " 1. Ouvre cette URL dans le navigateur (owner de la boîte) :"
echo "════════════════════════════════════════════════════════"
echo "$AUTH_URL"
echo
echo " Capture automatique sur 127.0.0.1:8765 (90 s)…"
CODEFILE="$(mktemp)"
python3 - "$CODEFILE" <<'PY' &
import http.server, socketserver, sys, threading, urllib.parse
codefile = sys.argv[1]
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        code = (q.get("code") or [None])[0]
        err  = (q.get("error") or [None])[0]
        with open(codefile, "w") as f:
            f.write(code or ("ERROR:" + str(err)))
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write("OK — tu peux fermer cette page.".encode())
        threading.Thread(target=self.server.shutdown).start()
    def log_message(self, *a): pass
with socketserver.TCPServer(("127.0.0.1", 8765), H) as srv:
    srv.serve_forever()
PY
CAPTURE_PID=$!
for _ in $(seq 1 90); do
    [ -s "$CODEFILE" ] && break
    sleep 1
done
kill "$CAPTURE_PID" 2>/dev/null || true

CODE=""
if [ -s "$CODEFILE" ] && ! grep -q '^ERROR:' "$CODEFILE"; then
    CODE="$(cat "$CODEFILE")"
    echo "[ ok ] code capturé automatiquement"
else
    echo
    echo " Capture auto échouée — copie-colle MANUELLEMENT le 'code' de l'URL"
    echo " affichée dans le navigateur (forme: http://127.0.0.1:8765/?code=4/0A...&scope=…)"
    printf 'code: '
    read -r CODE
fi
rm -f "$CODEFILE"
[ -n "$CODE" ] || { echo "[fail] aucun code fourni"; exit 1; }

echo
echo " 2. Échange code → refresh token…"
RESP=$(curl -sS -X POST https://oauth2.googleapis.com/token \
    -d "code=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$CODE")" \
    -d "client_id=$CID" -d "client_secret=$CSEC" -d "redirect_uri=$REDIRECT" \
    -d "grant_type=authorization_code")
REFRESH=$(printf '%s' "$RESP" | python3 -c "import json,sys;print(json.load(sys.stdin).get('refresh_token',''))" || true)
if [ -z "$REFRESH" ]; then
    echo "[fail] échange échoué — réponse (sans secret):"
    printf '%s' "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); d.pop('access_token',None); print(json.dumps(d, indent=2))"
    exit 1
fi

echo
echo "════════════════════════════════════════════════════════"
echo " ✅ Ajoute ces lignes (client.env du client / bashrc local de test) :"
echo "════════════════════════════════════════════════════════"
echo "GMAIL_CLIENT_ID=$CID"
echo "GMAIL_CLIENT_SECRET=$CSEC"
echo "GMAIL_REFRESH_TOKEN=$REFRESH"
echo "════════════════════════════════════════════════════════"
echo " ⚠️  chmod 600 sur le fichier. Jamais commité (.gitignore *.env)."
