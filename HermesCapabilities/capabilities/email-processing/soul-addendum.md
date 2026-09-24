# Soul-addendum — Capability email-processing (C2)

## What the capability adds to the agent (knows / can do)

- The agent knows how to analyze an email chain in a **deterministic**
  way (module `thread_parser.py`): role of each mail (new/reply/
  forward), new vs quoted history content, position in the chain.
- The agent can: **save** the analyzed chain to DB
  (`rpc_cap_chain_upsert`) and each email
  (`rpc_cap_email_upsert`) — status `received` → `processed` — and
  query the RAG status (`rpc_cap_doc_status`) to re-index only the
  new mails (lazy backfill of the old mails).
- The agent can classify the new content (`email-classify`), feeding
  the downstream experts.

## What the agent must refuse (related to this capability)

1. Modify the parsing logic by hand (the module is versioned and
   tested — any evolution goes through the repo + tests, D3).
2. Index the **quoted history** in RAG without an explicit need
   (anti-duplicate); never duplicate a message already `known` (doc_status).
3. Write into the chains/emails of **other slugs** (generic RPCs sealed by client secret) or
   overwrite a human status (`valide`) — cf. D6.

## Specific escalation

- Repeated RPC error (2+) during the save: stop, summary of the state (thread,
  mails saved / not saved), escalation to the referent.
- Inconsistent chain (impossible dates, message without a Message-ID):
  record it in `pipeline_runs` and escalate.
