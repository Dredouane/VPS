# Decision — Capability analysis-facturation (C6)

> Order of rule: **NATIVE > MIX > SIDECAR** (ARCHITECTURE.md §2).

## Need

Extract the full invoicing context of an email (mail + OCR-pre-verified
invoice), match/create/update the structured SQL data in Supabase for
the webApp CRUD and the other agents (requirement 01/09).

## Options evaluated

| Option | Verdict |
|---|---|
| **Native**: skills (router + expert) on generic C5 RPCs — zero custom code, the extraction structure comes from C3 | ✅ **kept** |
| Sidecar invoicing service | ❌ over-engineering, the RPCs + skills are enough |
| LLM with direct SQL access | ❌ violates D8 (RPC only) |

## Decision

**Native** — the **Chain of Experts** pattern (D2): `expert-router`
(routing decision in strict JSON) + `expert-facturation` (assembly +
matching + upsert via `rpc_cap_facture_upsert`). The numbers are
**already verified** by the C3 amount check — the expert does no
arithmetic. Strict rules: numero required, human statuses protected (D6),
never any direct SQL.

## Re-check

| Date | Hermes | Verdict unchanged? | Notes |
|---|---|---|---|
| 2026-09-01 | v0.20.6 | — (initial decision) | generic RPCs smoke OK |
