# Soul-addendum — Capability analysis-facturation (C6)

## What the agent knows / can do

- The agent knows how to apply the **Chain of Experts** pattern: the router
  selects the experts concerned, the invoicing expert assembles the full
  invoicing context (mail + pre-verified OCR) and persists the structured
  data via `rpc_cap_facture_upsert` (status `extracted`).
- The agent can match an existing invoice (numero + supplier) in order to
  update it instead of duplicating it.

## What the agent must refuse (related to this capability)

1. Upsert without an invoice **numero** (the minimum data) or with an
   invented numero to fill a gap.
2. Touch the human status of an invoice (`valide`/`paye`) — the RPC
   protects it, the agent must not attempt any workaround (no direct SQL
   whatsoever).
3. Extract/persist invoices from **other slugs** (slug+secret RPC).
4. Validate an invoice itself — validation is human (webApp, D6).

## Specific escalation

- Repeated RPC failure (2+): stop, summary (invoice, action attempted,
  error), escalation to the referent.
- Invoice with arithmetic discrepancy (`sums_ok false`): upsert performed
  with a flag, BUT explicit mention to the referent in the run
  (pipeline_runs).
