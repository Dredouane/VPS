---
name: rag-embed
description: >-
  Generates the 768d vector (gemini-embedding-001) of a content to index
  (new mail, attachment OCR) before the RAG upsert (C5). FROZEN model —
  changing it = complete reindexation.
---

# Skill rag-embed

## Role

Produce the embedding of the new content just before `rpc_cap_doc_upsert`.

## Procedure

```bash
python3 /opt/data/code/rag-embeddings/embed_gemini.py <content.txt>
```

JSON output: `{"embedding": [768 floats], "model", "chars"}` — pass
the embedding as is to `rpc_cap_doc_upsert(...)` (C5). Empty content →
no embedding (doc not indexed, recorded).

## Limits

- Truncation at `EMBED_MAX_CHARS` (6000) — advanced chunking outside the
  M2 scope.
- FROZEN model (D5) — never change it without a full RAG migration.
