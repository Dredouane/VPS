# ISSUE TEMPLATE — ICP SaaS Reviewer (spec-aligned)

> Standard format for a ticket usable by the code agent (opencode).
> Copy this file → name it `TICKET-XXX-short-title.md` → fill it in.
> One single problem / one single request per ticket (small, precise, actionable).
> Each ticket references the SPEC brick it belongs to
> (`spec/SPEC_Produit_Emails_Factures.md`) and the NonReg scenarios to check
> (`NonReg/REFERENCE_Scenarios_Spec_Emails_Factures.md`).

---

## Ticket AREV-XXX — <Short and actionable title>

- **Date**:
- **Spec reference**: relevant section(s) of `SPEC_Produit_Emails_Factures.md`
- **NonReg scenarios**: codes (e.g. C4, E5…) of `REFERENCE` to run for validation
- **Persona**: Fateh_Ug / Gerant_PME / Salarie_Backoffice
- **Priority**: High / Medium / Low
- **Type**: Bug / UX improvement / New feature / Non-regression

## Description (the contract)
What this iteration must produce, in 1-3 sentences oriented toward the end user.

## Current state (what the product does today)
What happens on screen today, factually, as opposed to the target.

## Expected state (definition of done)
The desired behavior, compliant with the spec — as concrete as possible.

## The persona's "pain" (why it matters)
What it costs the user if this ticket is not done (time, error, distrust).

## Acceptance criteria (validation checklist — MUST be verifiable)
- [ ] ...
- [ ] ...

## Notes (if useful)
Design/consistency elements, data to display, possible implications for other views.
DO NOT mention an imposed technical implementation: we specify, the code agent decides on the how.

---
