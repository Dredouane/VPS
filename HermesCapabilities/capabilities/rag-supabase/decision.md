# Decision — Capability rag-supabase (C5, pilot)

> Order of rule: **NATIVE > MIX > SIDECAR** (ARCHITECTURE.md §2).

## Need

Index business documents (text extracted from emails/OCR) into a vector
store and let the agent run similarity searches — basis of the client RAG.
The target DB is **Supabase** (already in place on the client side,
CRUD webapp served by the same project).

## Options evaluated

| Option | Verified availability | Verdict |
|---|---|---|
| **Native**: Hermes catalog MCP `supabase` + pgvector + RPC/RLS | ✅ `hermes mcp catalog` (VPS, 08/30/2026, v0.20.6): `supabase — Database, auth, and storage from your Supabase projects` | ✅ **kept** |
| Mix: PostgREST API driven by skill | Available but redundant with the MCP | ❌ |
| Sidecar: Python worker embeddings+save | Custom code to maintain, useless here | ❌ |

## Decision

**NATIVE** — the `supabase` MCP of the catalog covers DB access. Security is
provided by the access model:

- **Limited** key (`SUPABASE_RPC_KEY`) = dedicated Postgres role for the
  capability, with RLS + `EXECUTE` rights on the generic RPCs `rpc_cap_*` only. **Never
  the service key** (full-access).
- Dedicated schema/pgvector per client (`cap_<slug>`), `documents` table
  (`id, client_id, source, title, content, embedding vector, metadata jsonb,
  created_at`).
- Exposed RPCs (M2, to be created on the Supabase side):
  - `rpc_cap_doc_search(slug, secret, query_embedding, match_count)` → similarity
  - `rpc_cap_doc_upsert(slug, secret, kind, message_id, content, embedding, …)`
  - `rpc_cap_doc_delete` (to add if needed — outside M2 scope)
- Embeddings: outside C5's scope — provided by the
  `rag-embeddings` capability (C4, mix: Gemini/OpenRouter API). DeepSeek does not
  provide any.
- Plan B if the MCP catalog entry disappears: switch C5 to **mix** (skill →
  PostgREST) without changing the client-side manifest (secrets unchanged), or
  `neon`/`prisma-postgres` MCP (catalog) if DB migration.

## Re-check

| Date | Hermes | Verdict unchanged? | Notes |
|---|---|---|---|
| 2026-08-30 | v0.20.6 | — (initial decision) | Catalog checked on VPS |
