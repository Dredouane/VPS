# 🗃️ sql/ — Source de vérité du schéma Supabase (D9)

> Tous les scripts SQL du projet vivent ici, **versionnés git** et
> **append-only** (migrations numérotées). Le schéma est du code.

## Conventions

| Règle | Détail |
|---|---|
| Organisation | `sql/<slug>/` par client (`arev/`, futur `client2/`…) |
| Numérotation | `001_schema.sql` (création initiale), `002_rpc.sql`, `003_rls.sql`, puis `00N_*.sql` pour les migrations — **ne jamais modifier un fichier déjà appliqué** |
| Isolation client | Schéma dédié `cap_<slug>` + RPC `public.rpc_cap_<slug>_*` avec `client_id` **hardcodé** dans la fonction (D8) |
| Accès | RLS deny-all sur les tables, accès **uniquement** via RPC (clé publishable anon) — jamais la service key |
| pgvector | Type dans le schéma `extensions` (Supabase) — `vector(768)` figé (D5) |

## Ordre d'application

1. **Projet Supabase TEST** d'abord (toute validation de RPC se fait là)
2. Puis **projet prod** (celui de la webapp CRUD du client — D7)

Pour chaque projet, appliquer dans l'ordre : `001` → `002` → `003` → migrations.

Application : **éditeur SQL du dashboard Supabase** (copier/coller le fichier
complet) ou `psql "$DATABASE_URL" -f 001_schema.sql` si accès direct fourni.

## Consommation par les skills (D9)

`capability-attach.sh` copie `sql/<slug>/` → `instances/<slug>/data/sql/` :
l'agent (skills experts) peut **lire les définitions** (tables, RPC, statuts
permis) pour construire ses appels — sans jamais exécuter de DDL (impossible
de toute façon : RPC only).

## Contenu

| Client | Fichiers | État |
|---|---|---|
| `arev` | `001_schema.sql` · `002_rpc.sql` · `003_rls.sql` | ✅ prêts — à appliquer TEST puis prod (M2.0) |
