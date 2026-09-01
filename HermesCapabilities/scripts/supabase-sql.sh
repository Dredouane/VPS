#!/usr/bin/env bash
# supabase-sql.sh — Runner SQL Supabase à la demande (HermesCapabilities).
# Un projet multi-tenant : le slug discriminate (tables cap_* + RPC dédiées).
#
# Usage:
#   ./supabase-sql.sh <slug> status              # read-only: appliqués vs disponibles
#   ./supabase-sql.sh <slug> all [--yes] [--smoke]
#   ./supabase-sql.sh <slug> --file generic/001_schema.sql [--yes]
#
# URL admin: $SUPERBASE_VPS_DB_URL (bashrc local, jamais affichée).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_DIR="$BASE_DIR/sql"

SLUG=""; CMD=""; TARGET_FILE=""; YES=0; SMOKE=0; FORCE=0
prev=""
for a in "$@"; do
    if [ "$prev" = "--file" ]; then TARGET_FILE="$a"; prev=""; continue; fi
    case "$a" in
        --yes) YES=1 ;;
        --smoke) SMOKE=1 ;;
        --force) FORCE=1 ;;
        --file) prev="--file" ;;
        -h|--help) grep '^#' "$0" | head -10; exit 0 ;;
        status|all) CMD="$a" ;;
        *) if [ -z "$SLUG" ]; then SLUG="$a"; fi ;;
    esac
done

log()  { printf '\033[1;34m[sql  ]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ ok ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; }
die()  { fail "$*"; exit 1; }

[ -n "$SLUG" ] || die "Usage: $0 <slug> status|all [--yes] [--smoke] | --file <path>"
[ -d "$SQL_DIR/$SLUG" ] || die "Pas de dossier SQL pour le slug '$SLUG' ($SQL_DIR/$SLUG)"

# URL admin (extraction LITTÉRALE depuis le bashrc — jamais eval: le mot de
# passe peut contenir des $ qui seraient expandés; jamais affichée).
get_var() {  # $1 = nom de variable → valeur littérale (stdout)
    local line
    line="$(grep -m1 "^export $1=" ~/.bashrc 2>/dev/null)"
    [ -n "$line" ] || return 1
    line="${line#*=}"
    case "$line" in
        \"*\") line="${line#\"}"; line="${line%\"}" ;;
        \'*\') line="${line#\'}"; line="${line%\'}" ;;
    esac
    printf '%s' "$line"
}

if [ -z "${SUPERBASE_VPS_DB_URL:-}" ]; then
    SUPERBASE_VPS_DB_URL="$(get_var SUPERBASE_VPS_DB_URL)"
fi
[ -n "${SUPERBASE_VPS_DB_URL:-}" ] || die "SUPERBASE_VPS_DB_URL absente (bashrc local)"
PSQL=(psql "$SUPERBASE_VPS_DB_URL" -v ON_ERROR_STOP=1 --no-psqlrc -q)

# Tracker (bootstrap idempotent) — portée par-fichier, global au projet
TRACKER_SQL="create table if not exists public.cap_migrations (
    filename text primary key, scope text not null, applied_at timestamptz not null default now());"

# Fichiers à considérer pour ce slug: generic/ D'ABORD puis <slug>/ (tri par
# nom dans chaque groupe — les RPC dépendent des tables génériques)
list_files() {
    find "$SQL_DIR/generic" -maxdepth 1 -name '*.sql' -type f 2>/dev/null | sort | sed "s|$SQL_DIR/||"
    find "$SQL_DIR/$SLUG"   -maxdepth 1 -name '*.sql' -type f 2>/dev/null | sort | sed "s|$SQL_DIR/||"
}

is_applied() {
    "${PSQL[@]}" -tA -c "select count(*) from public.cap_migrations where filename = '$1';" 2>/dev/null | grep -q '^1$'
}

mark_applied() {
    "${PSQL[@]}" -c "insert into public.cap_migrations (filename, scope) values ('$1', '$2')
                     on conflict (filename) do nothing;" >/dev/null 2>&1
}

run_file() {  # $1 = chemin relatif (ex: generic/001_schema.sql)
    log "Apply: $1"
    if "${PSQL[@]}" --single-transaction -f "$SQL_DIR/$1"; then
        mark_applied "$1" "$(dirname "$1")"
        ok "Appliqué + tracké: $1"
    else
        fail "Échec: $1"
        return 1
    fi
}

# ---------------------------------------------------------------- status
if [ "$CMD" = "status" ]; then
    echo "── Migrations Supabase (projet unique multi-tenant) ──"
    echo "    (URL masquée — SUPERBASE_VPS_DB_URL)"
    "${PSQL[@]}" -c "$TRACKER_SQL" >/dev/null 2>&1 || die "Connexion/psql impossible (pooler ?)"
    while IFS= read -r f; do
        if is_applied "$f"; then ok   "appliqué   : $f"
        else                          warn "À APPLIQUER: $f"; fi
    done < <(list_files)
    echo
    "${PSQL[@]}" -tA -c "select 'tables cap_: ' || count(*) from pg_tables
        where schemaname='public' and tablename in ('cap_documents','cap_emails','cap_factures','cap_pipeline_runs');"
    "${PSQL[@]}" -tA -c "select 'rpc $SLUG: ' || count(*) from pg_proc
        where pronamespace = 'public'::regnamespace and proname like 'rpc_cap_${SLUG}_%';"
    exit 0
fi

# ---------------------------------------------------------------- apply
APPLY_LIST=()
if [ -n "$TARGET_FILE" ]; then
    [ -f "$SQL_DIR/$TARGET_FILE" ] || die "Fichier introuvable: $TARGET_FILE"
    APPLY_LIST=("$TARGET_FILE")
else
    [ "$CMD" = "all" ] || die "Commande: status | all | --file <path>"
    while IFS= read -r f; do APPLY_LIST+=("$f"); done < <(list_files)
fi

if [ "$YES" -ne 1 ]; then
    printf 'Appliquer sur le projet Supabase partagé ? [y/N] '
    read -r ans
    [ "$ans" = "y" ] || { echo "Annulé."; exit 0; }
fi

ERR=0
for f in "${APPLY_LIST[@]}"; do
    if is_applied "$f" && [ "$FORCE" -ne 1 ]; then
        ok "déjà appliqué: $f (skip)"
    else
        run_file "$f" || ERR=$((ERR+1))
    fi
done

# ---------------------------------------------------------------- post-checks
if [ "$ERR" -eq 0 ] && [ ${#APPLY_LIST[@]} -gt 0 ]; then
    N_TAB=$("${PSQL[@]}" -tA -c "select count(*) from pg_tables
        where schemaname='public' and tablename in ('cap_documents','cap_emails','cap_factures','cap_pipeline_runs');")
    N_RLS=$("${PSQL[@]}" -tA -c "select count(*) from pg_tables
        where schemaname='public' and rowsecurity and tablename like 'cap_%' and tablename <> 'cap_migrations';")
    N_RPC=$("${PSQL[@]}" -tA -c "select count(*) from pg_proc
        where pronamespace='public'::regnamespace and proname like 'rpc_cap_${SLUG}_%';")
    [ "$N_TAB" = "4" ] && ok "tables génériques: 4/4" || { fail "tables: $N_TAB/4"; ERR=$((ERR+1)); }
    [ "$N_RLS" = "4" ] && ok "RLS deny-all: 4/4"   || { fail "RLS: $N_RLS/4";  ERR=$((ERR+1)); }
    [ "$N_RPC" = "7" ] && ok "RPC $SLUG: 7/7"      || { fail "RPC: $N_RPC/7"; ERR=$((ERR+1)); }
fi

# ---------------------------------------------------------------- smoke
if [ "$SMOKE" = "1" ] && [ "$ERR" -eq 0 ]; then
    log "Smoke tests (marqués, nettoyés après)…"
    V0="('[$(python3 -c "print(','.join(['0.0']*768))")]'::extensions.vector)"
    R1=$("${PSQL[@]}" -tA -c "select public.rpc_cap_arev_doc_status(array['smoke-m-1']::text[]);")
    echo "$R1" | grep -q 'smoke-m-1,f' && ok "doc_status (unknown)" || { fail "doc_status (R1=$R1)"; ERR=$((ERR+1)); }
    R2=$("${PSQL[@]}" -tA -c "select public.rpc_cap_arev_doc_upsert('email','smoke-m-1','contenu smoke', $V0, 'smoke-t','nouveau',null,'smoke','{\"smoke\": true}'::jsonb);")
    [ -n "$R2" ] && ok "doc_upsert → $R2" || { fail "doc_upsert"; ERR=$((ERR+1)); }
    R3=$("${PSQL[@]}" -tA -c "select count(*) from public.rpc_cap_arev_doc_search($V0, 5) where content = 'contenu smoke';")
    [ "$R3" = "1" ] && ok "doc_search trouve le doc smoke" || { fail "doc_search"; ERR=$((ERR+1)); }
    R4=$("${PSQL[@]}" -tA -c "select (public.rpc_cap_arev_facture_upsert('SMOKE-0001','SMOKE')).action;")
    [ "$R4" = "insert" ] && ok "facture_upsert insert" || { fail "facture_upsert"; ERR=$((ERR+1)); }
    R5=$("${PSQL[@]}" -tA -c "select count(*) from public.rpc_cap_arev_facture_find('SMOKE-0001','SMOKE');")
    [ "$R5" = "1" ] && ok "facture_find" || { fail "facture_find"; ERR=$((ERR+1)); }
    "${PSQL[@]}" -tA -c "select public.rpc_cap_arev_pipeline_log('smoke');" >/dev/null \
        && ok "pipeline_log" || { fail "pipeline_log"; ERR=$((ERR+1)); }
    # Cleanup (accès admin du runner)
    "${PSQL[@]}" -c "delete from public.cap_documents where metadata->>'smoke' = 'true';
        delete from public.cap_emails where raw_metadata->>'smoke' = 'true';
        delete from public.cap_factures where numero like 'SMOKE-%';
        delete from public.cap_pipeline_runs where run_trigger = 'smoke';" >/dev/null && ok "cleanup smoke"
fi

[ "$ERR" -eq 0 ] && ok "Terminé sans erreur" || warn "Terminé AVEC ERREURS ($ERR)"
exit "$ERR"
