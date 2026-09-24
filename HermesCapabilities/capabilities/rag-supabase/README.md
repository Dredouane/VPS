# Capability rag-supabase (C5) — HermesCapabilities pilot

**Type**: `native` · **Status**: M1 contract validated — M2 implementation

Indexes the client's business documents (text extracted from emails/OCR)
into Supabase pgvector and enables similarity search (RAG), via the Hermes
native `supabase` MCP. Access key limited by RLS/RPC — never the
service key.

## Components

| File | Role |
|---|---|
| [manifest.yaml](manifest.yaml) | Contract: secrets `SUPABASE_URL` + `SUPABASE_RPC_KEY`, MCP `supabase`, skill `rag-search` |
| [decision.md](decision.md) | Native/mix/sidecar analysis (MCP catalog checked 08/30 v0.20.6) |
| [skill.md](skill.md) | Skill `rag-search` (similarity search, generic RPCs) |
| [mcp.json](mcp.json) | MCP supabase config (secrets by reference) |
| [soul-addendum.md](soul-addendum.md) | knows/can-do/refuse/escalate clauses |
| [tests/test.sh](tests/test.sh) | Contract inherited from TEMPLATE + C5 checks + VPS integration |

## Required secrets (in `HermesConfig/clients/<slug>/client.env`, 600)

| Variable | Role |
|---|---|
| `SUPABASE_URL` | URL of the client's Supabase project |
| `SUPABASE_RPC_KEY` | Key of the capability role (RLS + EXECUTE on `rpc_cap_*`) — **never the service key** |

## To do in M2 (implementation)

> Full pipeline design: [`../../PIPELINE_EMAIL_AREV.md`](../../PIPELINE_EMAIL_AREV.md)
> · Schema/RPC/RLS: [`../../sql/arev/`](../../sql/arev/) (source of truth, D9)

1. Supabase: create the `cap_arev` schema (`documents` table + pgvector),
   the capability role (RLS), the generic RPCs `rpc_cap_doc_search|doc_upsert` (+ doc_delete to add if needed)
   — TEST project first, then client prod.
2. Validate the MCP wiring on `hermes-arev-pro`: `hermes mcp install supabase`
   + env (emulate `capability-attach.sh arev rag-supabase --dry-run` then real).
3. Validate the location/loading of the custom skill (`data/skills/`).
4. VPS integration tests: upsert + search + delete on the TEST project.
5. Attach to `arev` (state: `instances/arev/capabilities.yaml`), check the
   SOUL.md is merged, gateway reconnected and healthy.

## Costs / quotas

No direct C5 cost (existing Supabase). Embedding costs are carried
by C4 (`rag-embeddings`).

## History

- 2026-08-30: contract creation (M1, pilot capability)
