# 🗃️ sql/ — Supabase SQL source of truth (D9-v2)

> **A single multi-tenant Supabase project** (clients, tests, prod) — the slug
> discriminates: generic `public.cap_*` tables with a `client_slug` column,
> generic RPCs + secret per slug with the slug **hardcoded** in the function.
> Everything is versioned in git and **append-only** (numbered migrations).

## Conventions

| Rule | Detail |
|---|---|
| Organisation | `sql/generic/` = common structure (without slug) · `sql/<slug>/` = **slug-dedicated** scripts (RPCs, specifics) — user decision |
| Tables | `public.cap_documents`, `cap_emails`, `cap_factures`, `cap_pipeline_runs` + **`cap_clients`** (D7-ter registry) — all with RLS deny-all |
| Registry | `cap_clients`: declared **by the runner** when applying a `<slug>/` folder (`--client-nom`, `--client-referent`). **FK** `client_slug → cap_clients.slug` on the 4 data tables — an undeclared slug cannot create data. Managed by the runner only (no agent RPC) |
| Numbering | `001_*.sql` per folder, then `002_…`, `003_…` for migrations — **never modify an already-applied file** (use a new number) |
| Tracker | `public.cap_migrations (filename, scope, applied_at)` — managed by the runner, an applied file is never reapplied (except `--force`, idempotent DDL) |
| Security | RLS deny-all on the tables; agents = publishable key + **RPC only** (`security definer`, `client_slug` hardcoded); webapp/admin = service key. Never the service key to an agent (D8-v2) |
| pgvector | `extensions.vector(768)` frozen (D5) |

## Environment vars (local bashrc — values never documented)

| Var | Usage |
|---|---|
| `VPS_SUPERBASE_VPS_DB_URL` | Admin connection string (pooler) — SQL runner |
| `VPS_SUPERBASE_VPS_DB_PROJECT_URL` | REST URL of the project (agent, M2.1+) |
| `VPS_SUPERBASE_VPS_DB_RPC_KEY` | Publishable key (agent, M2.1+) — never service key |

> ⚠️ The bashrc has an interactivity guard: the runner extracts the vars
> **literally** (`grep` + quote stripping, never `eval` — the password may
> contain `$`).

## Runner — `scripts/supabase-sql.sh`

```bash
./scripts/supabase-sql.sh arev status              # read-only: migrations + counts + registry
./scripts/supabase-sql.sh arev all [--yes] [--smoke] [--force] \
    [--client-nom "AREV Travaux"] [--client-referent "email@…"]
./scripts/supabase-sql.sh arev --file arev/001_rpc.sql [--force]
```

- `--yes`: without confirmation · `--force`: reapplies even if tracked (idempotent DDL)
- **Auto-declaration of the client** into `cap_clients` at apply time (idempotent) —
  before any slug file; the RPCs/FKs require a declared client
- `--smoke`: full RPC tests (doc_status/upsert/search, facture_upsert/find,
  pipeline_log) with marked rows then **admin cleanup**
- Built-in post-checks: 5 tables + RLS 5/5 + 7 slug RPCs + FK 4/4 + client declared
- Each file applied in `--single-transaction` (full rollback on error)

## State

| Folder | Files | Applied |
|---|---|---|
| `generic/` | `001_schema.sql` · `002_clients.sql` (registry + FK) | ✅ 01/09 |
| `arev/` | `001_rpc.sql` (7 RPCs + grants) | ✅ 31/08 (smoke 7/7 OK, FK active) |
| Registry | client `arev` — "AREV Travaux", active | ✅ 01/09 |
