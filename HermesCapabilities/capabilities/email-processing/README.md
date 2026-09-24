# Capability email-processing (C2) — thread parser + classification

**Type**: `native` · **Status**: M2.2 — parser + green tests, DB save via RPC
(applied + smoke OK), classify skill refined at M2.5

The hardened module (D3): a mailChain (thread.json of the C1 spool) →
structured list of mails — role (new/reply/forward), new vs quoted content,
position, chain aggregate, RAG status (lazy backfill of the old ones).
Then the **DB SAVE**: `cap_email_chains` + `cap_emails` via RPC (user
requirement 01/09).

## Components

| File | Role |
|---|---|
| [manifest.yaml](manifest.yaml) | Contract (code `thread_parser`, skill `email-classify`) |
| [decision.md](decision.md) | Native — parsing = deterministic code, never LLM |
| [code/thread_parser.py](code/thread_parser.py) | The hardened module (pure, locked fixtures) |
| [skill.md](skill.md) | Skill `email-classify` (LLM classification of the new content) |
| [soul-addendum.md](soul-addendum.md) | Clauses: no manual parsing, no RAG duplicates, no other slugs |
| [tests/test.sh](tests/test.sh) | Unit tests (roles, FR/EN/Outlook quotes, idempotence, rag_status) |

## Output contract (PIPELINE §2.2)

```json
{"thread_id", "chain": {subject, participants, messages_count, first/last_message_at},
 "mails": [{message_id, uid, role, position, new_content, quoted_segments[],
           attachments, rag_status: "known"|"new"}],
 "stats": {total, new, known, roles}}
```

**DB save (orchestrator)**: `rpc_cap_chain_upsert(...)` (1×) +
`rpc_cap_email_upsert(...)` (per mail) — status `received`, then
`processed` after RAG/experts. Already applied + smoke OK (01/09).

## History

- 2026-09-01: creation (M2.2) — parser + FR/EN/Outlook fixtures + DB save
  (generic `cap_email_chains` + arev RPC, user requirement).
