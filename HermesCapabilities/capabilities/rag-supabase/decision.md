# Decision — Capability rag-supabase (C5, pilote)

> Règle d'ordre : **NATIF > MIX > SIDECAR** (ARCHITECTURE.md §2).

## Besoin

Indexer des documents métier (texte extrait des emails/OCR) dans un store
vectoriel et permettre à l'agent de faire des recherches par similarité —
base du RAG client. La DB cible est **Supabase** (déjà en place côté client,
webapp CRUD desservie par le même projet).

## Options évaluées

| Option | Disponibilité vérifiée | Verdict |
|---|---|---|
| **Natif** : MCP `supabase` du catalogue Hermes + pgvector + RPC/RLS | ✅ `hermes mcp catalog` (VPS, 30/08/2026, v0.20.6) : `supabase — Database, auth, and storage from your Supabase projects` | ✅ **retenu** |
| Mix : API PostgREST pilotée par skill | Disponible mais redondant avec le MCP | ❌ |
| Sidecar : worker Python embeddings+save | Code custom à maintenir, inutile ici | ❌ |

## Décision

**NATIF** — le MCP `supabase` du catalogue couvre l'accès DB. La sécurité est
assurée par le modèle d'accès :

- Clé **limitée** (`SUPABASE_RPC_KEY`) = rôle Postgres dédié capability, avec
  RLS + droits `EXECUTE` sur les RPC `rpc_cap_<slug>_*` uniquement. **Jamais
  la service key** (full-access).
- Schéma/pgvector dédié par client (`cap_<slug>`), table `documents`
  (`id, client_id, source, title, content, embedding vector, metadata jsonb,
  created_at`).
- RPC exposées (M2, à créer côté Supabase) :
  - `rpc_cap_<slug>_search(query_embedding, match_count)` → similarité
  - `rpc_cap_<slug>_upsert(doc_id, source, title, content, embedding, metadata)`
  - `rpc_cap_<slug>_delete(doc_id)`
- Embeddings : hors périmètre de C5 — fournis par la capability
  `rag-embeddings` (C4, mix : API Gemini/OpenRouter). DeepSeek n'en fournit
  pas.
- Plan B si le MCP catalogue disparaît : basculer C5 en **mix** (skill →
  PostgREST) sans changer le manifest côté client (secrets inchangés), ou
  MCP `neon`/`prisma-postgres` (catalog) si migration DB.

## Re-vérification

| Date | Hermes | Verdict inchangé ? | Notes |
|---|---|---|---|
| 2026-08-30 | v0.20.6 | — (décision initiale) | Catalog vérifié sur VPS |
