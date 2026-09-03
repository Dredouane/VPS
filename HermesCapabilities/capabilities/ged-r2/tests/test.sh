#!/usr/bin/env bash
# Tests ged-r2 — SigV4 (vecteur AWS officiel) + sauvegarde réelle R2 si creds.
set -uo pipefail
CAP_DIR="${CAPABILITY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CAP_ID="${CAPABILITY_ID:-ged-r2}"
export CAPABILITY_DIR="$CAP_DIR" CAPABILITY_ID="$CAP_ID"
PASS=0; FAIL=0; SKIPN=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[1;33m~\033[0m %s\n' "$*"; SKIPN=$((SKIPN+1)); }

if "$CAP_DIR/../TEMPLATE/tests/test.sh"; then ok "contrat TEMPLATE hérité"
else fail "contrat TEMPLATE"; fi

CODE="$CAP_DIR/code"
if python3 - "$CODE" <<'PY'
import sys
sys.path.insert(0, sys.argv[1])
import r2_client as r2

# SigV4 : vecteur officiel AWS test suite (GET /, us-east-1, service 'service')
h = r2.sigv4_headers(
    "GET", "http://example.amazonaws.com/", b"",
    "AKIDEXAMPLE", "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    None, region="us-east-1", service="service",
    amzdate="20150830T123600Z", s3=False)
expected = "5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"
assert h["Authorization"].endswith(expected), h["Authorization"]

# object_url path-style
assert r2.object_url("https://acct.eu.r2.cloudflarestorage.com", "bucket",
                     "arev/emails/t1/thread.json") == \
    "https://acct.eu.r2.cloudflarestorage.com/bucket/arev/emails/t1/thread.json"

# ged_save: clé déterministe
import ged_save
k = ged_save.object_key("emails", "arev", "t1", "thread.json")
assert k == "emails/arev/emails/t1/thread.json"
print("UNIT-OK")
PY
then ok "unitaires ged-r2 (SigV4 vecteur AWS, object_url, clé déterministe)"
else fail "unitaires ged-r2"
fi

# Intégration réelle R2 (upload → get → head → delete) si creds présentes
if [ -n "${VPS_GED_CLOUDFLARE_ACCESS_KEY_ID:-}" ] && [ -n "${VPS_GED_CLOUDFLARE_SECRET_ACCESS_KEY:-}" ]; then
    if python3 - <<'PY'
import os, sys, json
sys.path.insert(0, os.path.join(os.environ.get("CAP_DIR", "."), "code"))
import r2_client as r2
cfg = {"VPS_GED_CLOUDFLARE_ACCESS_KEY_ID": os.environ["VPS_GED_CLOUDFLARE_ACCESS_KEY_ID"],
       "VPS_GED_CLOUDFLARE_SECRET_ACCESS_KEY": os.environ["VPS_GED_CLOUDFLARE_SECRET_ACCESS_KEY"],
       "VPS_GED_CLOUDFLARE_TOKEN": os.environ.get("VPS_GED_CLOUDFLARE_TOKEN", "")}
ep = os.environ["VPS_GED_CLOUDFLARE_S3_EU_ENDPOINT"]
bk = os.environ["VPS_GED_CLOUDFLARE_BUCKET_NAME"]
key = f"_hermes-test/smoke-{os.getpid()}.txt"
r2.put_object(ep, bk, key, b"hermes-smoke", cfg)
assert r2.head_object(ep, bk, key, cfg), "head après put"
assert r2.get_object(ep, bk, key, cfg) == b"hermes-smoke"
r2.delete_object(ep, bk, key, cfg)
assert not r2.head_object(ep, bk, key, cfg), "head après delete"
print("R2-OK")
PY
    then ok "intégration R2 réelle (put/get/head/delete + cleanup)"
    else fail "intégration R2 réelle"
    fi
else
    skip "intégration R2 (creds VPS_GED_CLOUDFLARE_* absentes — source le bashrc)"
fi

printf '  ── %s: %d PASS, %d FAIL\n' "$CAP_ID" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
