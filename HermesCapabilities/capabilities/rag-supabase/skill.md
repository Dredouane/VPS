---
name: rag-search
description: >-
  Similarity search in the client's Supabase RAG (pgvector via the MCP
  supabase, generic RPCs). To use when the agent needs to retrieve indexed
  documents/excerpts (emails, attachments, notes) to answer a
  business request.
---

# Skill rag-search

> ⚠️ Exact location of custom skills in the dockerized instance to be validated
> in M2 (`hermes skills --help` + trial on `hermes-arev-pro`). The attach
> copies this file to `data/skills/rag-search/SKILL.md` (best-effort).

## Role

Retrieve relevant documents from the client's RAG base (Supabase
pgvector) to ground the agent's answers on its business documents.

## When to use it

- User request about past documents (“find the quote…”)
- Before answering a factual question in the documents scope
- In analysis routines (e.g.: invoicing — cross-check with the indexed documents)

## Procedure

1. Build the search query: rephrase the request into compact text
   (one query = one intention).
2. Get the query embedding (`rag-embeddings` capability).
3. Call the dedicated RPC via the `supabase` MCP:
   `rpc_cap_doc_search(slug, secret, query_embedding, match_count)` — **never any direct
   SQL**, never any schema other than `cap_<slug>`.
4. Render: title, source, date, relevant excerpt (quote, do not
   invent). If no relevant result (low score) → say so.

## Limits

- The RAG contains only what has been indexed — never present an absence
  of result as a business truth.
- All writes go through `rpc_cap_doc_upsert` / (`doc_delete` to add if needed) (capability
  rag-supabase), never any DDL.
