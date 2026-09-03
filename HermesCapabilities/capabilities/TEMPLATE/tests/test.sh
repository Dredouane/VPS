#!/usr/bin/env bash
# Tests de contrat d'une capability HermesCapabilities (communs à toutes).
# Self-reporting: chaque check affiche ✓/✗; exit 0 = tout passé.
# Les tests spécifiques métier s'ajoutent APRÈS le marqueur (et SKIPent
# proprement sans secrets/VPS — voir exemple rag-supabase).
set -uo pipefail

CAP_DIR="${CAPABILITY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CAP_ID="${CAPABILITY_ID:-$(basename "$CAP_DIR")}"
MANIFEST="$CAP_DIR/manifest.yaml"

PASS=0; FAIL=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
fail() { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }

# 1. Manifest : parse YAML + champs requis + cohérences conditionnelles
if python3 - "$MANIFEST" "$CAP_DIR" <<'PY'
import sys, yaml, os
m_path, cap_dir = sys.argv[1], sys.argv[2]
m = yaml.safe_load(open(m_path))
assert m.get("id") and m.get("version"), "id/version manquants"
assert m.get("type") in ("natif", "mix", "sidecar"), f"type invalide: {m.get('type')}"
assert m.get("soul_addendum"), "soul_addendum manquant"
assert m.get("tests"), "tests manquant"
for k in ("secrets", "mcp", "skills", "routines", "mounts", "env"):
    assert isinstance(m.get(k) or [], (list, dict)), f"{k} doit être list/dict"
cap_id = os.path.basename(cap_dir.rstrip("/"))
if cap_id != "TEMPLATE":
    assert m["id"] == cap_id, f"id ({m['id']}) != dossier ({cap_id})"
if m.get("mcp"):
    assert os.path.isfile(os.path.join(cap_dir, "mcp.json")), "mcp non vide → mcp.json requis"
if m.get("skills"):
    assert os.path.isfile(os.path.join(cap_dir, "skill.md")) or \
        all(os.path.isfile(os.path.join(cap_dir, "skills", s + ".md")) for s in m["skills"]), \
        "skills non vide → skill.md OU skills/<id>.md pour chaque skill requis"
if m.get("routines"):
    assert os.path.isfile(os.path.join(cap_dir, "routine.yaml")), "routines non vide → routine.yaml requis"
if m.get("code"):
    code_dir = os.path.join(cap_dir, "code")
    assert os.path.isdir(code_dir), "code non vide → dossier code/ requis"
    for mod in m["code"]:
        assert os.path.isfile(os.path.join(code_dir, mod + ".py")), f"module code manquant: {mod}.py"
PY
then ok "manifest.yaml — schéma + cohérences conditionnelles"; else fail "manifest.yaml — invalide"; fi

# 2. id == dossier (sauf TEMPLATE)
if [ "$CAP_ID" = "TEMPLATE" ] || grep -qE "^id:\s*${CAP_ID}\s*$" "$MANIFEST"; then
    ok "id cohérent avec le dossier ($CAP_ID)"
else fail "id != nom de dossier"; fi

# 3. soul-addendum : clauses obligatoires
SA="$CAP_DIR/soul-addendum.md"
if [ -f "$SA" ] && grep -qi "refuse" "$SA" && grep -qi "sait\|peut" "$SA" && grep -qi "escalade" "$SA"; then
    ok "soul-addendum.md — sait/peut + refuse + escalade"
else fail "soul-addendum.md — clauses obligatoires absentes"; fi

# 4. decision.md : verdict natif/mix/sidecar présent
if [ -f "$CAP_DIR/decision.md" ] && grep -qiE "verdict.*(natif|mix|sidecar)|\*\*(NATIF|MIX|SIDECAR)\*\*" "$CAP_DIR/decision.md"; then
    ok "decision.md — verdict présent"
else fail "decision.md — verdict natif/mix/sidecar absent"; fi

# 5. Pas de secret réel dans les fichiers de la capability (patterns tokens/keys)
if ! grep -rEq '(sk-[A-Za-z0-9]{10,}|[0-9]{6,12}:AA[A-Za-z0-9_-]{30,}|ghp_[A-Za-z0-9]{20,})' "$CAP_DIR" --include='*.yaml' --include='*.md' --include='*.json'; then
    ok "aucun secret réel dans la capability"
else fail "SECRET détecté dans la capability"; fi

# === TESTS SPÉCIFIQUES MÉTIER (à ajouter sous ce marqueur) ===
# Exemple de SKIP propre sans VPS/secrets :
#   if [ -z "${SOME_SECRET:-}" ]; then printf '  \033[1;33m~\033[0m test métier (SKIP: secret absent)\n'; fi

# --- Verdict ---
printf '  ── %s: %d PASS, %d FAIL\n' "$CAP_ID" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
