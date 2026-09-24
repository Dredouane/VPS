# Capability rag-embeddings (C4) — 768d vectors

**Type**: `mix` · **Status**: M2.4 — code + tests, real integration
(embed "test" → 768d verified)

Generates the `gemini-embedding-001` vectors (Gemini, **768d frozen** — D5)
of the contents to index. RAG upsert = C5 (`rpc_cap_doc_upsert`).

## Components

| File | Role |
|---|---|
| [manifest.yaml](manifest.yaml) | Contract: secret VPS_GEMINI_API_KEY, code embed_gemini |
| [code/embed_gemini.py](code/embed_gemini.py) | stdlib embedContent, dimension checked, truncation 6000 |
| [skill.md](skill.md) | Skill `rag-embed` |
| [soul-addendum.md](soul-addendum.md) | Refusals: changing the model, indexing empty content |
| [tests/test.sh](tests/test.sh) | Unit tests (payload, parse, dimension) + real integration |

## Secrets

`VPS_GEMINI_API_KEY` (local bashrc → client.env, 600).

## History

- 2026-09-01: creation (M2.4).
