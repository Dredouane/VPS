# Capability analysis-facturation (C6) — invoicing expert

**Type**: `native` · **Status**: M2.5 — skills + RPC tested (smoke), pipeline
wiring at M2.6

**Chain of Experts** (D2): `expert-router` determines the experts concerned
by a structured email; `expert-facturation` assembles the full context
(mail + invoice pre-verified by the C3 amount check) and persists the
structured invoice into Supabase (`rpc_cap_facture_upsert`, status
`extracted` — D6), available for the webApp CRUD and the other agents.

## Components

| File | Role |
|---|---|
| [manifest.yaml](manifest.yaml) | Contract: router + expert skills, zero code (C5 RPC) |
| [skill.md](skill.md) | `expert-router` — strict JSON list of experts |
| [skill2.md](skill2.md) | `expert-facturation` — matching + upsert + strict rules |
| [soul-addendum.md](soul-addendum.md) | Refusals: no invented numero, no human status touched |
| [tests/test.sh](tests/test.sh) | Contract (the RPCs are tested in supabase-sql.sh --smoke) |

## Data produced

`cap_factures`: numero, supplier (+identifier), dates, amounts net/VAT/
gross, status `extracted` → human validation webApp (`valide`/`rejete`),
confidence, links email_message_id + document_id, audit payload `extraction`.

## History

- 2026-09-01: creation (M2.5) — expert skills + generic RPC wiring.
