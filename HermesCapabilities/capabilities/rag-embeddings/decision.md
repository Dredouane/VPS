# Decision — Capability rag-embeddings (C4)

> Order of rule: **NATIVE > MIX > SIDECAR** (ARCHITECTURE.md §2).

## Need

Generate the 768d vectors of the contents to index (new mails, attachment
OCR) for the RAG — FROZEN model (D5: changing = reindex everything).

## Options evaluated

| Option | Verdict |
|---|---|
| **Mix**: Gemini `gemini-embedding-001` (768d) via stdlib API — existing SUREN key | ✅ **kept** |
| OpenAI embeddings (1536d) | ❌ new key + dimension ≠ current schema |
| Local embeddings (Ollama) | ❌ one more piece on the VPS |
| DeepSeek | ❌ does not expose an embeddings API |

## Decision

**MIX** — `embed_gemini.py` (stdlib): `embedContent` with dimension
checked (768) and 6000-char truncation. The upsert goes through the
generic C5 RPCs. Plan B if Google removes the model: re-evaluate OpenAI
(migration = full reindexation, D5).

## Re-check

| Date | Hermes | Verdict unchanged? | Notes |
|---|---|---|---|
| 2026-09-01 | v0.20.6 | — (initial decision) | real integration 768d verified |
