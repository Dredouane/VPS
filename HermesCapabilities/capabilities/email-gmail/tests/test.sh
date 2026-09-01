#!/usr/bin/env bash
# Tests email-gmail (M2.1-bis, IMAP). Unitaires SANS réseau + intégration
# réelle read-only si creds présents dans l'environnement.
set -uo pipefail
CAP_DIR="${CAPABILITY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CAP_ID="${CAPABILITY_ID:-email-gmail}"
export CAPABILITY_DIR="$CAP_DIR" CAPABILITY_ID="$CAP_ID"
PASS=0; FAIL=0; SKIPN=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[1;33m~\033[0m %s\n' "$*"; SKIPN=$((SKIPN+1)); }

if "$CAP_DIR/../TEMPLATE/tests/test.sh"; then ok "contrat TEMPLATE hérité"
else fail "contrat TEMPLATE"; fi

CODE="$CAP_DIR/code"
FIX="$CAP_DIR/tests/fixtures"
if python3 - "$CODE" "$FIX" <<'PY'
import sys, os, json, tempfile
sys.path.insert(0, sys.argv[1])
import imap_poll as ip
code_dir, fix_dir = sys.argv[1], sys.argv[2]

# alias + query (D10)
assert ip.alias_address("REDACTED_EMAIL", "+AREV") == "REDACTED_EMAIL"
assert ip.alias_address("REDACTED_EMAIL", "AREV")  == "REDACTED_EMAIL"
q = ip.build_query("REDACTED_EMAIL", "+AREV", "ia-traite", 90)
assert "to:REDACTED_EMAIL" in q and "-label:ia-traite" in q and "newer_than:90d" in q

# safe_filename
assert ip.safe_filename("plan-chantier.pdf") == "plan-chantier.pdf"
assert ip.safe_filename("ré/ fact*ure!.pdf") == "fact_ure_.pdf"  # basename d'abord

# parse raw plain+PJ
raw = open(os.path.join(fix_dir, "rfc822_sample_plain.eml"), "rb").read()
m = ip.parse_raw_message(raw)
assert m["message_id"] == "<msgA@example.com>"
assert "demande de devis" in m["body_plain"].lower()
assert m["header_from"].startswith("Client Dupont")
assert len(m["attachments"]) == 1
att = m["attachments"][0]
assert att["filename"] == "plan-chantier.pdf" and att["mime"] == "application/pdf"
assert att["size"] > 0 and att["data"].startswith(b"%PDF")

# parse raw html (fallback strip déterministe)
rawh = open(os.path.join(fix_dir, "rfc822_sample_html.eml"), "rb").read()
mh = ip.parse_raw_message(rawh)
assert mh["message_id"] == "<msgB@example.com>"
assert "merci" in mh["body_plain"].lower()
assert mh["attachments"] == []
assert mh["header_in_reply_to"] == "<msgA@example.com>"

# grouping thrid (simulation rows IMAP réels: tuples (entête, attrs))
rows = [(b"1 (UID 1720)", b"1720 (UID 1720 X-GM-THRID 1875124411713563599)"),
        (b"2 (UID 1721)", b"1721 (UID 1721 X-GM-THRID 1875124411713563599)"),
        (b"3 (UID 1722)", b"1722 (UID 1722 X-GM-THRID 1875136147878076317)")]
g = ip.parse_uid_attrs(rows)
assert g[1720] == 1875124411713563599 and g[1722] == 1875136147878076317
threads = ip.group_by_thread(g)
assert set(threads.keys()) == {1875124411713563599, 1875136147878076317}
assert threads[1875124411713563599] == [1721, 1720]  # récents d'abord

# spool writer (data déplacée vers fichiers)
with tempfile.TemporaryDirectory() as td:
    import copy
    msgs = [copy.deepcopy(m)]  # copie: data sera déplacée vers fichier
    path = ip.write_thread(td, 1875124411713563599, msgs)
    j = json.load(open(path))
    assert j["thread_id"] == "1875124411713563599"
    att = j["messages"][0]["attachments"][0]
    assert att.get("path") and os.path.isfile(att["path"]) \
        and open(att["path"], "rb").read().startswith(b"%PDF")
    assert "data" not in att
print("UNIT-OK")
PY
then ok "unitaires imap_poll (alias, query, parsing eml, grouping, spool)"
else fail "unitaires imap_poll"
fi

# Intégration réelle (readonly) si creds — count >= 0 + structure
if [ -n "${GMAIL_RECEPTION_IMAP_ADRESS:-}" ] && [ -n "${GMAIL_RECEPTION_IMAP_MDP:-}" ]; then
    TMPD="$(mktemp -d)"
    if GMAIL_RECEPTION_IMAP_ADRESS="$GMAIL_RECEPTION_IMAP_ADRESS" \
       GMAIL_RECEPTION_IMAP_MDP="$GMAIL_RECEPTION_IMAP_MDP" \
       GMAIL_ALIAS_TAG="+AREV" GMAIL_MAX_THREADS="2" GMAIL_SPOOL_DIR="$TMPD" \
       python3 "$CODE/imap_poll.py" > /tmp/imap-poll-test.json 2>/tmp/imap-poll-test.err; then
        python3 -c "import json;d=json.load(open('/tmp/imap-poll-test.json'));assert isinstance(d.get('count'), int) and d['count'] >= 0 and 'spool_dir' in d" \
            && ok "intégration poller réel (readonly, count=$(python3 -c "import json;print(json.load(open('/tmp/imap-poll-test.json'))['count'])"))" \
            || fail "intégration poller — structure invalide"
    else
        fail "intégration poller réel (exit $?) — $(head -c 120 /tmp/imap-poll-test.err)"
    fi
    rm -rf "$TMPD"
else
    skip "intégration réseau (creds GMAIL_RECEPTION_* absents — source le bashrc pour tester en réel)"
fi

printf '  ── %s: %d PASS, %d FAIL\n' "$CAP_ID" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
