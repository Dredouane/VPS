#!/usr/bin/env bash
# supabase-sql.sh — Runner SQL Supabase à la demande (HermesCapabilities).
# Un projet multi-tenant : le slug discriminate (tables cap_* + RPC dédiées).
#
# Usage:
#   ./supabase-sql.sh <slug> status              # read-only: appliqués vs disponibles
#   ./supabase-sql.sh <slug> all [--yes] [--smoke]
#   ./supabase-sql.sh <slug> --file generic/001_schema.sql [--yes]
#
# URL admin: $VPS_SUPERBASE_VPS_DB_URL (bashrc local, jamais affichée).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_DIR="$BASE_DIR/sql"

SLUG=""; CMD=""; TARGET_FILE=""; YES=0; SMOKE=0; FORCE=0
CLIENT_NOM=""; CLIENT_REF=""
prev=""
for a in "$@"; do
    if [ "$prev" = "--file" ]; then TARGET_FILE="$a"; prev=""; continue; fi
    if [ "$prev" = "--client-nom" ]; then CLIENT_NOM="$a"; prev=""; continue; fi
    if [ "$prev" = "--client-referent" ]; then CLIENT_REF="$a"; prev=""; continue; fi
    case "$a" in
        --yes) YES=1 ;;
        --smoke) SMOKE=1 ;;
        --force) FORCE=1 ;;
        --file) prev="--file" ;;
        --client-nom) prev="--client-nom" ;;
        --client-referent) prev="--client-referent" ;;
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

if [ -z "${VPS_SUPERBASE_VPS_DB_URL:-}" ]; then
    VPS_SUPERBASE_VPS_DB_URL="$(get_var VPS_SUPERBASE_VPS_DB_URL)"
fi
[ -n "${VPS_SUPERBASE_VPS_DB_URL:-}" ] || die "VPS_SUPERBASE_VPS_DB_URL absente (bashrc local)"
PSQL=(psql "$VPS_SUPERBASE_VPS_DB_URL" -v ON_ERROR_STOP=1 --no-psqlrc -q)

# client.env du client (HermesConfig voisin) — pour CLIENT_RPC_SECRET (D8-v3)
HC_BASE="${HERMESCONFIG_BASE:-$(cd "$BASE_DIR/.." && pwd)/HermesConfig}"
CLIENT_ENV="$HC_BASE/clients/$SLUG/client.env"

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

sql_esc() {  # escape simple quotes pour interpolation SQL safe
    printf '%s' "$1" | sed "s/'/''/g"
}

# Déclaration du client (registry D7-ter) — appelée AVANT le 1er fichier slug
is_client_declared() {
    "${PSQL[@]}" -tA -c "select count(*) from public.cap_clients where slug = '$SLUG';" 2>/dev/null | grep -q '^1$'
}

declare_client() {
    local nom ref sec
    nom="$(sql_esc "${CLIENT_NOM:-$SLUG}")"
    ref="$(sql_esc "$CLIENT_REF")"
    local sql="insert into public.cap_clients (slug, nom, statut, rpc_prefix"
    [ -n "$ref" ] && sql="$sql, referent"
    sql="$sql) values ('$SLUG', '$nom', 'active', 'rpc_cap_${SLUG}_'"
    [ -n "$ref" ] && sql="$sql, '$ref'"
    sql="$sql) on conflict (slug) do nothing;"
    if "${PSQL[@]}" -c "$sql" >/dev/null 2>&1; then
        ok "client déclaré: $SLUG (nom: ${CLIENT_NOM:-$SLUG})"
    else
        fail "déclaration client '$SLUG' échouée"
        return 1
    fi
    # Secret RPC par slug (D8-v3) — généré si absent, écrit dans client.env
    ensure_client_secret
}

ensure_client_secret() {
    local has sec
    has="$("${PSQL[@]}" -tA -c "select count(rpc_secret) from public.cap_clients where slug='$SLUG' and rpc_secret is not null;" 2>/dev/null)"
    if [ "$has" = "1" ]; then
        ok "secret RPC déjà présent pour $SLUG"
        # Migration: secret en DB mais absent du client.env → le récupérer
        if [ -f "$CLIENT_ENV" ] && ! grep -q '^CLIENT_RPC_SECRET=' "$CLIENT_ENV"; then
            sec="$("${PSQL[@]}" -tA -c "select rpc_secret from public.cap_clients where slug='$SLUG';" 2>/dev/null)"
            if [ -n "$sec" ]; then
                printf '\n# Secret RPC capability (généré automatiquement — ne pas partager)\nCLIENT_RPC_SECRET=%s\n' "$sec" >> "$CLIENT_ENV"
                chmod 600 "$CLIENT_ENV"
                ok "CLIENT_RPC_SECRET récupéré de la DB → $CLIENT_ENV (600)"
            fi
        fi
        return 0
    fi
    sec="$(python3 -c "import secrets; print(secrets.token_hex(24))")"
    if ! "${PSQL[@]}" -c "update public.cap_clients set rpc_secret='$sec' where slug='$SLUG';" >/dev/null 2>&1; then
        warn "génération du secret RPC échouée pour $SLUG"
        return 1
    fi
    if [ -f "$CLIENT_ENV" ] && ! grep -q '^CLIENT_RPC_SECRET=' "$CLIENT_ENV"; then
        printf '\n# Secret RPC capability (généré automatiquement — ne pas partager)\nCLIENT_RPC_SECRET=%s\n' "$sec" >> "$CLIENT_ENV"
        chmod 600 "$CLIENT_ENV"
        ok "CLIENT_RPC_SECRET généré → $CLIENT_ENV (600)"
    else
        ok "secret RPC généré en DB (client.env: ajouter CLIENT_RPC_SECRET manuellement)"
    fi
}

# ---------------------------------------------------------------- status
if [ "$CMD" = "status" ]; then
    echo "── Migrations Supabase (projet unique multi-tenant) ──"
    echo "    (URL masquée — VPS_SUPERBASE_VPS_DB_URL)"
    "${PSQL[@]}" -c "$TRACKER_SQL" >/dev/null 2>&1 || die "Connexion/psql impossible (pooler ?)"
    while IFS= read -r f; do
        if is_applied "$f"; then ok   "appliqué   : $f"
        else                          warn "À APPLIQUER: $f"; fi
    done < <(list_files)
    echo
    "${PSQL[@]}" -tA -c "select 'tables cap_: ' || count(*) from pg_tables
        where schemaname='public' and tablename like 'cap_%';"
    "${PSQL[@]}" -tA -c "select 'rpc génériques: ' || count(*) from pg_proc
        where pronamespace = 'public'::regnamespace and proname in
        ('rpc_cap_doc_status','rpc_cap_doc_upsert','rpc_cap_doc_search',
         'rpc_cap_email_upsert','rpc_cap_chain_upsert','rpc_cap_chain_get',
         'rpc_cap_facture_find','rpc_cap_facture_upsert','rpc_cap_pipeline_log');"
    if "${PSQL[@]}" -tA -c "select count(*) from pg_tables where schemaname='public' and tablename='cap_clients';" | grep -q '^1$'; then
        "${PSQL[@]}" -tA -c "select 'clients: ' || coalesce(string_agg(slug, ', '), '(aucun)') from public.cap_clients;"
    else
        warn "registry absente — apply générique/002_clients.sql"
    fi
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
# Auto-déclaration du client (registry D7-ter) — idempotent, les RPC/FK
# exigent un client déclaré.
if ! is_client_declared; then
    declare_client || ERR=$((ERR+1))
fi
for f in "${APPLY_LIST[@]}"; do
    if is_applied "$f" && [ "$FORCE" -ne 1 ]; then
        ok "déjà appliqué: $f (skip)"
    else
        run_file "$f" || ERR=$((ERR+1))
    fi
done

# ---------------------------------------------------------------- post-checks
# Compteurs DYNAMIQUES : RPC GÉNÉRIQUES attendues (>= 9) et per-slug = 0
# (clean swap D8-v3 — les per-slug sont retirées).
if [ "$ERR" -eq 0 ] && [ ${#APPLY_LIST[@]} -gt 0 ]; then
    N_TAB=$("${PSQL[@]}" -tA -c "select count(*) from pg_tables
        where schemaname='public' and tablename like 'cap_%';")
    N_RLS=$("${PSQL[@]}" -tA -c "select count(*) from pg_tables
        where schemaname='public' and rowsecurity and tablename like 'cap_%';")
    N_RPC=$("${PSQL[@]}" -tA -c "select count(*) from pg_proc
        where pronamespace='public'::regnamespace and proname in
        ('rpc_cap_doc_status','rpc_cap_doc_upsert','rpc_cap_doc_search',
         'rpc_cap_email_upsert','rpc_cap_chain_upsert','rpc_cap_chain_get',
         'rpc_cap_facture_find','rpc_cap_facture_upsert','rpc_cap_pipeline_log');")
    N_SLUGRPC=$("${PSQL[@]}" -tA -c "select count(*) from pg_proc
        where pronamespace='public'::regnamespace and proname like 'rpc_cap_%'
        and proname not in
        ('rpc_cap_doc_status','rpc_cap_doc_upsert','rpc_cap_doc_search',
         'rpc_cap_email_upsert','rpc_cap_chain_upsert','rpc_cap_chain_get',
         'rpc_cap_facture_find','rpc_cap_facture_upsert','rpc_cap_pipeline_log');")
    N_FK=$("${PSQL[@]}" -tA -c "select count(*) from pg_constraint
        where conname like 'cap_%_slug_fk';")
    [ "$N_TAB" -ge 5 ] && ok "tables cap_*: $N_TAB"      || { fail "tables: $N_TAB (min 5)"; ERR=$((ERR+1)); }
    [ "$N_RLS" = "$N_TAB" ] && ok "RLS deny-all: $N_RLS/$N_TAB" || { fail "RLS: $N_RLS/$N_TAB"; ERR=$((ERR+1)); }
    [ "$N_RPC" -ge 9 ] && ok "RPC génériques: $N_RPC"   || { fail "RPC génériques: $N_RPC (min 9)"; ERR=$((ERR+1)); }
    [ "$N_SLUGRPC" -eq 0 ] && ok "RPC per-slug: 0 (clean swap)" || { fail "RPC per-slug restantes: $N_SLUGRPC"; ERR=$((ERR+1)); }
    [ "$N_FK" -ge 4 ]  && ok "FK client_slug: $N_FK"    || { fail "FK: $N_FK (min 4)"; ERR=$((ERR+1)); }
    if is_client_declared; then ok "client '$SLUG' déclaré (registry)"
    else warn "client '$SLUG' NON déclaré (apply un fichier slug pour le déclarer)"; fi
fi

# ---------------------------------------------------------------- smoke
if [ "$SMOKE" = "1" ] && [ "$ERR" -eq 0 ]; then
    log "Smoke tests (génériques, marqués, nettoyés après)…"
    # Secret du client lu côté admin (bypass RLS) — jamais affiché.
    # Généré à la volée si absent (clients déclarés avant D8-v3).
    SEC="$("${PSQL[@]}" -tA -c "select rpc_secret from public.cap_clients where slug='$SLUG' and statut='active';" 2>/dev/null)"
    if [ -z "$SEC" ]; then
        ensure_client_secret || { fail "génération secret RPC impossible pour '$SLUG'"; ERR=$((ERR+1)); }
        SEC="$("${PSQL[@]}" -tA -c "select rpc_secret from public.cap_clients where slug='$SLUG';" 2>/dev/null)"
    fi
    [ -n "$SEC" ] || { fail "pas de secret RPC pour '$SLUG'"; ERR=$((ERR+1)); }
    if [ -n "$SEC" ]; then
        # psql interpole :'var' uniquement via stdin (jamais -c) — le secret
        # ne transite pas par la ligne de commande
        sq() { "${PSQL[@]}" -v slug="$SLUG" -v rpc_secret="$SEC" -tA; }
        V0="('[$(python3 -c "print(','.join(['0.0']*768))")]'::extensions.vector)"
        # 0. Garde : secret invalide rejeté
        if "${PSQL[@]}" -tA -c "select public.rpc_cap_doc_status('$SLUG','WRONG-SECRET',array['x']::text[]);" >/dev/null 2>&1; then
            fail "garde D8-v3: secret invalide ACCEPTÉ (!)"; ERR=$((ERR+1))
        else
            ok "garde: secret invalide rejeté"
        fi
        # 1. doc_status
        R1=$(sq <<SQL
select public.rpc_cap_doc_status(:'slug', :'rpc_secret', array['smoke-m-1']::text[]);
SQL
)
        echo "$R1" | grep -q 'smoke-m-1,f' && ok "doc_status (unknown)" || { fail "doc_status (R1=$R1)"; ERR=$((ERR+1)); }
        # 2. doc_upsert (ordre: slug, secret, kind, message_id, content, embedding, thread, role, parent, title, metadata)
        R2=$(sq <<SQL
select public.rpc_cap_doc_upsert(:'slug', :'rpc_secret', 'email','smoke-m-1','contenu smoke', $V0, 'smoke-t','nouveau',null,'smoke','{"smoke": true}'::jsonb);
SQL
)
        [ -n "$R2" ] && ok "doc_upsert → $R2" || { fail "doc_upsert"; ERR=$((ERR+1)); }
        # 3. doc_search
        R3=$(sq <<SQL
select count(*) from public.rpc_cap_doc_search(:'slug', :'rpc_secret', $V0, 5) where content = 'contenu smoke';
SQL
)
        [ "$R3" = "1" ] && ok "doc_search trouve le doc smoke" || { fail "doc_search"; ERR=$((ERR+1)); }
        # 4. email_upsert
        R4=$(sq <<SQL
select public.rpc_cap_email_upsert(:'slug', :'rpc_secret', 'smoke-m-1','smoke-t','nouveau','smoke@x.tld','Sujet smoke',null,'autre','résumé smoke','received',null,'{"smoke": true}'::jsonb);
SQL
)
        [ -n "$R4" ] && ok "email_upsert → $R4" || { fail "email_upsert"; ERR=$((ERR+1)); }
        # 5. chain_upsert + get
        sq <<SQL >/dev/null
select public.rpc_cap_chain_upsert(:'slug', :'rpc_secret', 'smoke-thread-1','Sujet smoke','["a@x.tld"]'::jsonb, 1, null, null);
SQL
        [ ${PIPESTATUS[0]:-0} -eq 0 ] && ok "chain_upsert" || { fail "chain_upsert"; ERR=$((ERR+1)); }
        R6=$(sq <<SQL
select count(*) from public.rpc_cap_chain_get(:'slug', :'rpc_secret', 'smoke-thread-1');
SQL
)
        [ "$R6" = "1" ] && ok "chain_get" || { fail "chain_get"; ERR=$((ERR+1)); }
        # 6. facture_upsert + find
        R7=$(sq <<SQL
select (public.rpc_cap_facture_upsert(:'slug', :'rpc_secret', 'SMOKE-0001','SMOKE')).action;
SQL
)
        [ "$R7" = "insert" ] && ok "facture_upsert insert" || { fail "facture_upsert"; ERR=$((ERR+1)); }
        R8=$(sq <<SQL
select count(*) from public.rpc_cap_facture_find(:'slug', :'rpc_secret', 'SMOKE-0001','SMOKE');
SQL
)
        [ "$R8" = "1" ] && ok "facture_find" || { fail "facture_find"; ERR=$((ERR+1)); }
        # 7. pipeline_log
        sq <<SQL >/dev/null
select public.rpc_cap_pipeline_log(:'slug', :'rpc_secret', 'smoke');
SQL
        [ ${PIPESTATUS[0]:-0} -eq 0 ] && ok "pipeline_log" || { fail "pipeline_log"; ERR=$((ERR+1)); }
        # Cleanup (accès admin du runner)
        "${PSQL[@]}" -c "delete from public.cap_documents where metadata->>'smoke' = 'true';
            delete from public.cap_emails where raw_metadata->>'smoke' = 'true';
            delete from public.cap_factures where numero like 'SMOKE-%';
            delete from public.cap_email_chains where thread_id like 'smoke-%';
            delete from public.cap_pipeline_runs where run_trigger = 'smoke';" >/dev/null && ok "cleanup smoke"
    fi
fi

[ "$ERR" -eq 0 ] && ok "Terminé sans erreur" || warn "Terminé AVEC ERREURS ($ERR)"
exit "$ERR"
