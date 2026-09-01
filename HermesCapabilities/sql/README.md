# 🗃️ sql/ — Source de vérité SQL Supabase (D9-v2)

> **Un seul projet Supabase multi-tenant** (clients, tests, prod) — le slug
> discrimine : tables génériques `public.cap_*` avec colonne `client_slug`,
> RPC dédiées par slug avec le slug **hardcodé** dans la fonction.
> Tout est versionné git et **append-only** (migrations numérotées).

## Conventions

| Règle | Détail |
|---|---|
| Organisation | `sql/generic/` = structure commune (sans slug) · `sql/<slug>/` = scripts **dédiés au slug** (RPC, spécificités) — décision utilisateur |
| Tables | `public.cap_documents`, `cap_emails`, `cap_factures`, `cap_pipeline_runs` + **`cap_clients`** (registry D7-ter) — toutes avec RLS deny-all |
| Registry | `cap_clients` : déclarée **par le runner** à l'apply d'un dossier `<slug>/` (`--client-nom`, `--client-referent`). **FK** `client_slug → cap_clients.slug` sur les 4 tables de données — un slug non déclaré ne peut pas créer de données. Gérée par le runner uniquement (aucune RPC agent) |
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
./scripts/supabase-sql.sh arev status              # read-only : migrations + counts + registry
./scripts/supabase-sql.sh arev all [--yes] [--smoke] [--force] \
    [--client-nom "AREV Travaux"] [--client-referent "email@…"]
./scripts/supabase-sql.sh arev --file arev/001_rpc.sql [--force]
```

- `--yes` : sans confirmation · `--force` : réapplique même si tracké (DDL idempotent)
- **Auto-déclaration du client** dans `cap_clients` à l'apply (idempotent) —
  avant tout fichier slug ; les RPC/FK exigent un client déclaré
- `--smoke` : tests RPC complets (doc_status/upsert/search, facture_upsert/find,
  pipeline_log) avec lignes marquées puis **cleanup admin**
- Post-checks intégrés : 5 tables + RLS 5/5 + 7 RPC du slug + FK 4/4 + client déclaré
- Chaque fichier appliqué en `--single-transaction` (rollback total si erreur)

## État

| Dossier | Fichiers | Appliqué |
|---|---|---|
| `generic/` | `001_schema.sql` · `002_clients.sql` (registry + FK) | ✅ 01/09 |
| `arev/` | `001_rpc.sql` (7 RPC + grants) | ✅ 31/08 (smoke 7/7 OK, FK actif) |
| Registry | client `arev` — "AREV Travaux", active | ✅ 01/09 |
