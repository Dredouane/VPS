#!/usr/bin/env bash
# capability-attach.sh — Attache des capabilities HermesCapabilities à un client HermesConfig.
#
# Modes:
#   sudo ./capability-attach.sh <slug> <cap-id>... [--dry-run]   # sur le VPS (docker + hermes)
#   ./capability-attach.sh --selftest [cap-id...]                # local: parse + plan factice (sans VPS)
#
# Ce que fait l'attachement (par capability, depuis son manifest.yaml):
#   1. Valide les secrets requis dans HermesConfig/clients/<slug>/client.env (600)
#      — comptage de valeurs non vides, JAMAIS d'affichage.
#   2. Active les MCP servers (mcp.json) dans le conteneur (hermes mcp).
#   3. Installe les skills (skill.md → instances/<slug>/data/skills/<id>/SKILL.md).
#   4. Crée les routines cron (routine.yaml → hermes cron create, bot Ops).
#   5. Merge le soul-addendum dans data/SOUL.md (marqueurs idempotents).
#   6. Met à jour instances/<slug>/capabilities.yaml (état).
#   7. Redémarre le conteneur (config changée) + vérifie la reconnexion.
#
# Securité: secrets par NOM, jamais en CLI/YAML/git. --dry-run = aucun changement.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPS_BASE="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPS_DIR="$CAPS_BASE/capabilities"
HC_BASE="${HERMESCONFIG_BASE:-$(cd "$CAPS_BASE/.." && pwd)/HermesConfig}"

DRY_RUN=0; SELFTEST=0; POSITIONAL=()
for a in "$@"; do
    case "$a" in
        --dry-run) DRY_RUN=1 ;;
        --selftest) SELFTEST=1 ;;
        -h|--help) grep '^#' "$0" | head -14; exit 0 ;;
        *) POSITIONAL+=("$a") ;;
    esac
done

if [ "$SELFTEST" = "1" ]; then
    [ ${#POSITIONAL[@]} -gt 0 ] || POSITIONAL=(rag-supabase)
    CAPS=("${POSITIONAL[@]}")
    SLUG="selftest"
else
    [ ${#POSITIONAL[@]} -gt 1 ] || die "Usage: $0 <slug> <cap-id>... [--dry-run]"
    SLUG="${POSITIONAL[0]}"
    CAPS=("${POSITIONAL[@]:1}")
fi

log()  { printf '\033[1;34m[attach]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ ok ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

# --- Résolution des chemins (réel vs selftest) --------------------------------
if [ "$SELFTEST" = "1" ]; then
    TMPD="$(mktemp -d)"
    trap 'rm -rf "$TMPD"' EXIT
    CLIENT_ENV="$TMPD/client.env"          # factice: aucun secret requis présent
    printf 'CLIENT_SLUG=selftest\nTELEGRAM_BOT_TOKEN=dummy\n' > "$CLIENT_ENV"
    INSTANCE_DIR="$TMPD/instances/selftest"
    DATA_DIR="$INSTANCE_DIR/data"
    CONTAINER=""                            # aucune action docker
    MODE="SELFTEST (plan factice — secrets volontairement absents)"
else
    [ -n "$SLUG" ] || die "Usage: $0 <slug> <cap-id>... [--dry-run]"
    [ ${#CAPS[@]} -gt 0 ] || die "Aucune capability fournie"
    [ "$(id -u)" -eq 0 ] || die "À exécuter en root (chown data, docker exec)"
    [ -d "$HC_BASE" ] || die "HermesConfig introuvable: $HC_BASE"
    CLIENT_ENV="$HC_BASE/clients/$SLUG/client.env"
    INSTANCE_DIR="$HC_BASE/instances/$SLUG"
    DATA_DIR="$INSTANCE_DIR/data"
    CONTAINER="hermes-$SLUG-pro"
    MODE=$([ "$DRY_RUN" = "1" ] && echo "DRY-RUN" || echo "APPLY")
    [ -f "$CLIENT_ENV" ] || die "Absent: $CLIENT_ENV"
    [ -d "$DATA_DIR" ] || die "Instance non déployée (data absent): $DATA_DIR"
    [ "$(stat -c %a "$CLIENT_ENV")" = "600" ] || warn "client.env n'est pas en 600 — corriger"
fi

log "Attach capabilities → client '$SLUG' — mode $MODE"

# --- Helpers -------------------------------------------------------------------
parse_manifest() {  # $1=manifest.yaml $2=out-fichier KEY=VALEUR
    python3 - "$1" "$2" <<'PY'
import sys, yaml
m = yaml.safe_load(open(sys.argv[1]))
def l(k): return " ".join(m.get(k) or [])
with open(sys.argv[2], "w") as f:
    f.write(f"CAP_ID={m.get('id','')}\n")
    f.write(f"CAP_VERSION={m.get('version','0.0.0')}\n")
    f.write(f"CAP_TYPE={m.get('type','')}\n")
    f.write(f"CAP_SECRETS='{l('secrets')}'\n")
    f.write(f"CAP_MCP='{l('mcp')}'\n")
    f.write(f"CAP_SKILLS='{l('skills')}'\n")
    f.write(f"CAP_CODE='{l('code')}'\n")
    f.write(f"CAP_ROUTINES='{l('routines')}'\n")
    f.write(f"CAP_SOUL={m.get('soul_addendum','soul-addendum.md')}\n")
PY
}

merge_soul() {  # $1=cap_id $2=addendum $3=SOUL.md cible (idempotent)
    python3 - "$1" "$2" "$3" <<'PY'
import sys
cap_id, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
start, end = f"<!-- capability:{cap_id}:start -->", f"<!-- capability:{cap_id}:end -->"
addendum = open(src).read().strip()
try:
    content = open(dst).read()
except FileNotFoundError:
    content = "# SOUL.md\n"
out, skip = [], False
for ln in content.splitlines():
    if ln.strip() == start: skip = True; continue
    if ln.strip() == end:   skip = False; continue
    if not skip: out.append(ln)
text = "\n".join(out).rstrip() + "\n\n" + start + "\n" + addendum + "\n" + end + "\n"
open(dst, "w").write(text)
PY
}

update_state() {  # $1=cap_id $2=version $3=capabilities.yaml
    python3 - "$1" "$2" "$3" <<'PY'
import sys, yaml, datetime
cap_id, version, path = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    state = yaml.safe_load(open(path)) or {}
except FileNotFoundError:
    state = {}
caps = [c for c in (state.get("capabilities") or []) if c.get("id") != cap_id]
caps.append({"id": cap_id, "version": version,
             "attached_at": datetime.datetime.now().isoformat(timespec="seconds")})
state["capabilities"] = caps
yaml.safe_dump(state, open(path, "w"), sort_keys=False, allow_unicode=True)
PY
}

interpolate() {  # remplace {{CLIENT_SLUG}} par le slug
    sed -e "s/{{CLIENT_SLUG}}/$SLUG/g"
}

# --- Traitement par capability --------------------------------------------------
GLOBAL_RESULT=0
CHANGED=0
for CAP in "${CAPS[@]}"; do
    echo
    log "── Capability: $CAP ─────────────────────────────"
    CAP_DIR="$CAPS_DIR/$CAP"
    [ -d "$CAP_DIR" ] || { die "Capability inconnue: $CAP ($CAPS_DIR/$CAP)"; }

    ParsedFile="$(mktemp)"
    parse_manifest "$CAP_DIR/manifest.yaml" "$ParsedFile"
    # shellcheck disable=SC1090
    . "$ParsedFile"
    rm -f "$ParsedFile"

    [ "$CAP_ID" = "$CAP" ] || { die "manifest id '$CAP_ID' != dossier '$CAP'"; }
    ok "manifest: $CAP_ID v$CAP_VERSION ($CAP_TYPE)"

    # 1. Secrets requis présents et non vides (comptage, jamais de valeur)
    MISSING=0
    for VAR in $CAP_SECRETS; do
        if [ -f "$CLIENT_ENV" ] && grep -qE "^${VAR}=.+" "$CLIENT_ENV"; then
            ok "secret présent: $VAR"
        else
            warn "secret MANQUANT: $VAR (à ajouter dans clients/$SLUG/client.env)"
            MISSING=$((MISSING+1))
            # En selftest, l'absence de secrets est le scénario de démonstration
            [ "$SELFTEST" = "0" ] && GLOBAL_RESULT=1
        fi
    done
    [ "$MISSING" -gt 0 ] && [ "$DRY_RUN" = "0" ] && [ "$SELFTEST" = "0" ] && \
        die "$MISSING secret(s) manquant(s) — renseigner client.env avant APPLY"

    # 2. MCP servers
    for M in $CAP_MCP; do
        if [ "$DRY_RUN" = "1" ] || [ "$SELFTEST" = "1" ]; then
            log "  [plan] hermes mcp install $M (env de mcp.json, secrets par référence)"
        else
            log "  Activation MCP '$M' dans $CONTAINER…"
            # Résolution des ${VAR} du mcp.json → valeurs de client.env (sourcées, non affichées)
            set -a; . "$CLIENT_ENV"; set +a
            ENV_ARGS=()
            while IFS='=' read -r k v; do
                case "$k" in _*|'' ) continue ;; esac
                val="${v#\"}"; val="${val%\"}"
                case "$val" in "\${"*"}") varname="${val#\$\{}"; varname="${varname%\}}"; val="${!varname:-}" ;; esac
                ENV_ARGS+=(-e "$k=$val")
            done < <(python3 -c "import json; [print(f'{k}={v}') for k,v in json.load(open('$CAP_DIR/mcp.json')).get('env',{}).items()]")
            if docker exec "${ENV_ARGS[@]}" "$CONTAINER" hermes mcp install "$M" >/dev/null 2>&1 \
               || docker exec "${ENV_ARGS[@]}" "$CONTAINER" hermes mcp add "$M" >/dev/null 2>&1; then
                ok "MCP '$M' activé"
                CHANGED=1
            else
                warn "MCP '$M': échec (vérifier 'hermes mcp install --help' / mcp.json en M2)"
                GLOBAL_RESULT=1
            fi
            unset ENV_ARGS
        fi
    done

    # 3. Skills — skills/<S>.md prioritaire, sinon skill.md unique (v1.1)
    for S in $CAP_SKILLS; do
        SRC_MD="$CAP_DIR/skill.md"
        [ -f "$CAP_DIR/skills/$S.md" ] && SRC_MD="$CAP_DIR/skills/$S.md"
        if [ "$DRY_RUN" = "1" ] || [ "$SELFTEST" = "1" ]; then
            log "  [plan] skill '$S' ($(basename "$SRC_MD")) → data/skills/$S/SKILL.md"
        else
            mkdir -p "$DATA_DIR/skills/$S"
            install -o 10000 -g 10000 -m 640 "$SRC_MD" "$DATA_DIR/skills/$S/SKILL.md"
            ok "skill '$S' installée (emplacement custom à valider M2)"
            CHANGED=1
        fi
    done

    # 3. Code déterministe (v1.1) → data/code/<cap>/
    if [ -n "$CAP_CODE" ]; then
        if [ "$DRY_RUN" = "1" ] || [ "$SELFTEST" = "1" ]; then
            log "  [plan] code: $CAP_CODE → data/code/$CAP_ID/"
        else
            mkdir -p "$DATA_DIR/code/$CAP_ID"
            cp -f "$CAP_DIR"/code/*.py "$DATA_DIR/code/$CAP_ID/"
            chown -R 10000:10000 "$DATA_DIR/code"
            chmod 640 "$DATA_DIR/code/$CAP_ID"/*.py
            ok "code copié: $CAP_CODE (data/code/$CAP_ID/)"
            CHANGED=1
        fi
    fi

    # 4. Routines
    if [ -n "$CAP_ROUTINES" ]; then
        if [ "$DRY_RUN" = "1" ] || [ "$SELFTEST" = "1" ]; then
            log "  [plan] routines: $CAP_ROUTINES (hermes cron create, profile ops)"
        else
            python3 - "$CAP_DIR/routine.yaml" > "$INSTANCE_DIR/.routines.$$" <<'PY'
import sys, yaml
for r in yaml.safe_load(open(sys.argv[1])).get("routines", []):
    print(f"{r['id']}\t{r.get('schedule','')}\t{(r.get('prompt') or '').strip()}\t{r.get('profile','')}")
PY
            while IFS=$'\t' read -r rid rsched rprompt rprof; do
                if docker exec "$CONTAINER" hermes cron create ${rprof:+--profile "$rprof"} "$rsched" "$rprompt" >/dev/null 2>&1; then
                    ok "routine '$rid' créée ($rsched)"
                    CHANGED=1
                else
                    warn "routine '$rid': échec de création (vérifier manuellement dans le conteneur)"
                    GLOBAL_RESULT=1
                fi
            done < "$INSTANCE_DIR/.routines.$$"
            rm -f "$INSTANCE_DIR/.routines.$$"
        fi
    fi

    # 5. Soul-addendum (idempotent)
    if [ "$DRY_RUN" = "1" ]; then
        log "  [plan] soul-addendum mergé dans data/SOUL.md (marqueurs capability:$CAP_ID)"
    else
        mkdir -p "$DATA_DIR"
        SOUL="$DATA_DIR/SOUL.md"
        [ -f "$SOUL" ] || { warn "SOUL.md absent — création minimale"; printf '# SOUL.md\n' > "$SOUL"; }
        merge_soul "$CAP_ID" "$CAP_DIR/$CAP_SOUL" "$SOUL"
        [ "$SELFTEST" = "1" ] || chown 10000:10000 "$SOUL"
        chmod 640 "$SOUL" 2>/dev/null || true
        ok "soul-addendum mergé (marqueurs capability:$CAP_ID)"
        CHANGED=1
    fi

    # 6. État de l'instance
    if [ "$DRY_RUN" = "1" ]; then
        log "  [plan] capabilities.yaml ← $CAP_ID v$CAP_VERSION"
    else
        mkdir -p "$INSTANCE_DIR"
        update_state "$CAP_ID" "$CAP_VERSION" "$INSTANCE_DIR/capabilities.yaml"
        [ "$SELFTEST" = "1" ] || chown 10000:10000 "$INSTANCE_DIR/capabilities.yaml"
        ok "état mis à jour: $INSTANCE_DIR/capabilities.yaml"
    fi
done

# --- 6bis. Définitions SQL client (D9) -------------------------------------------
SQL_SRC="$CAPS_BASE/sql/$SLUG"
if [ -d "$SQL_SRC" ]; then
    if [ "$DRY_RUN" = "1" ]; then
        log "[plan] sql/$SLUG/ → data/sql/ (définitions pour les skills experts)"
    else
        mkdir -p "$DATA_DIR/sql"
        cp -f "$SQL_SRC"/*.sql "$DATA_DIR/sql/"
        chown -R 10000:10000 "$DATA_DIR/sql"
        chmod 640 "$DATA_DIR/sql"/*.sql
        ok "définitions SQL copiées (data/sql/) — source de vérité des skills"
        CHANGED=1
    fi
fi

# --- 7. Redémarrage (APPLY réel uniquement) -------------------------------------
if [ "$SELFTEST" = "0" ] && [ "$DRY_RUN" = "0" ] && [ "$CHANGED" = "1" ] && [ -n "$CONTAINER" ]; then
    log "Redémarrage de $CONTAINER (config changée)…"
    docker restart "$CONTAINER" >/dev/null
    for _ in $(seq 1 30); do
        if docker exec "$CONTAINER" grep -qs '"state":"connected"' /opt/data/gateway_state.json 2>/dev/null; then
            ok "gateway reconnecté (Telegram)"
            break
        fi
        sleep 3
    done
    warn "Vérifier la santé: sudo $HC_BASE/scripts/audit-hermes-pro.sh $SLUG"
fi

echo
if [ "$GLOBAL_RESULT" -eq 0 ]; then
    ok "Attachement terminé sans erreur ($MODE)"
else
    warn "Attachement terminé AVEC ALERTES ($MODE) — voir les [warn] ci-dessus"
fi
exit "$GLOBAL_RESULT"
