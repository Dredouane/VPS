# 🗃️ sql/ — Source de vérité SQL Supabase (D9-v2)

> **Un seul projet Supabase multi-tenant** (clients, tests, prod) — le slug
> discrimine : tables génériques `public.cap_*` avec colonne `client_slug`,
> RPC dédiées par slug avec le slug **hardcodé** dans la fonction.
> Tout est versionné git et **append-only** (migrations numérotées).

## Conventions

| Règle | Détail |
|---|---|
| Organisation | `sql/generic/` = structure commune (sans slug) · `sql/<slug>/` = scripts **dédiés au slug** (RPC, spécificités) — décision utilisateur |
| Tables | `public.cap_documents`, `cap_emails`, `cap_factures`, `cap_pipeline_runs` — toutes avec `client_slug text not null` |
| Numérotation | `001_*.sql` par dossier, puis `002_…`, `003_…` pour les migrations — **ne jamais modifier un fichier déjà appliqué** (utiliser un nouveau numéro) |
| Tracker | `public.cap_migrations (filename, scope, applied_at)` — géré par le runner, un fichier appliqué n'est jamais réappliqué (sauf `--force`, DDL idempotent) |
| Sécurité | RLS deny-all sur les tables ; agents = clé publishable + **RPC only** (`security definer`, `client_slug` hardcodé) ; webapp/admin = service key. Jamais la service key à un agent (D8-v2) |
| pgvector | `extensions.vector(768)` figé (D5) |

## Vars d'environnement (bashrc local — valeurs jamais documentées)

| Var | Usage |
|---|---|
| `SUPERBASE_VPS_DB_URL` | Connection string admin (pooler) — runner SQL |
| `SUPERBASE_VPS_DB_PROJECT_URL` | URL REST du projet (agent, M2.1+) |
| `SUPERBASE_VPS_DB_RPC_KEY` | Clé publishable (agent, M2.1+) — jamais service key |

> ⚠️ Le bashrc a un guard d'interactivité : le runner extrait les vars
> **littéralement** (`grep` + strip de quotes, jamais `eval` — le mot de
> passe peut contenir des `$`).

## Runner — `scripts/supabase-sql.sh`

```bash
./scripts/supabase-sql.sh arev status              # read-only : appliqués vs disponibles + counts
./scripts/supabase-sql.sh arev all [--yes] [--smoke]   # générique D'ABORD puis <slug>/ (ordre critique)
./scripts/supabase-sql.sh arev --file arev/001_rpc.sql [--force]
```

- `--yes` : sans confirmation · `--force` : réapplique même si tracké (DDL idempotent)
- `--smoke` : tests RPC complets (doc_status/upsert/search, facture_upsert/find,
  pipeline_log) avec lignes marquées puis **cleanup admin**
- Post-checks intégrés : 4 tables + RLS 4/4 + 7 RPC du slug
- Chaque fichier appliqué en `--single-transaction` (rollback total si erreur)

## État

| Dossier | Fichiers | Appliqué |
|---|---|---|
| `generic/` | `001_schema.sql` | ✅ 31/08 |
| `arev/` | `001_rpc.sql` (7 RPC + grants) | ✅ 31/08 (smoke 7/7 OK) |
