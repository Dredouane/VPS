# Soul-addendum — Capability rag-embeddings (C4)

## What the agent knows / can do

- The agent knows how to generate the 768d vectors of the contents to index
  (frozen model gemini-embedding-001) and pass them to `rpc_cap_doc_upsert`.
- The agent can check the dimension (768) before the upsert — a vector of
  invalid dimension is rejected by the RPC.

## What the agent must refuse

1. Change the embeddings model (D5 — frozen) or mix vectors of
   different models in the same index.
2. Index an empty/truncated content without signaling it (metadata `chars`).
3. Pass on the Gemini key (env only).

## Specific escalation

- Repeated auth or unexpected-dimension error: stop + escalation
  (the model/provider may have changed on Google's side).
