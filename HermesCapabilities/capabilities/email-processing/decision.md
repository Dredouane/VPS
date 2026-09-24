# Decision — Capability email-processing (C2)

> Order of rule: **NATIVE > MIX > SIDECAR** (ARCHITECTURE.md §2).

## Need

Understand a mailChain: who wrote what, where the received mail sits
(new subject / reply / forward), separate the **new content** from the
**quoted history** (anti RAG-duplicate), and know the RAG status of
each mail (already indexed / new — lazy backfill of the old mails).
Then **save** chain + emails to DB (cap_email_chains + cap_emails).

## Options evaluated

| Option | Verdict |
|---|---|
| **Native**: deterministic code module (`thread_parser.py`, stdlib, fixtures) | ✅ **kept** |
| LLM-based parsing (prompt) | ❌ non-deterministic, untestable, hallucinations on quotes |
| Sidecar service | ❌ useless — pure code with no network I/O |

## Decision

**Native** — quote parsing (`Le … a écrit :`, `On … wrote:`,
`----- Message d'origine -----`, `>` lines), role detection and
chain aggregation are **parsing** problems: they must be
idempotent and non-regressive (D3). The module is **pure**: input =
spool thread.json + optional list of message_ids already in RAG (provided
by the orchestrator via `rpc_cap_doc_status`); output = complete
structure (§2.2 contract of PIPELINE). The **DB SAVE** (chains + emails) is
done by the orchestrator via the RPCs (`chain_upsert`, `email_upsert`) — the
module stays I/O-free.

The **business classification** (`email-classify`, LLM) is a separate skill:
it receives only the new content.

## Re-check

| Date | Hermes | Verdict unchanged? | Notes |
|---|---|---|---|
| 2026-09-01 | v0.20.6 | — (initial decision) | |
