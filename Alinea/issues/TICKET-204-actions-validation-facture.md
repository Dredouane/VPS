# Ticket AREV-204 — Invoices module: validation actions (Validate / Correct / Reject) with safe feedback

- **Date**: 2026-09-08
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §1.2 (§2.2 zone A: validation actions) — EU6 ref, actions part
- **NonReg scenarios**: E6 (+ E1/E2 for correction)
- **Persona**: Salarie_Backoffice (primary)
- **Priority**: High
- **Type**: Bug + Improvement (make the current path reliable)

## Description (the contract)
On the detail page of an invoice "À traiter" [To process], the operator can **Validate** the extracted
data, **Correct** a wrong value, or **Reject** the invoice — with clear and
persistent status feedback. The status transitions correctly and stays right after a refresh.

## Current state (observed today)
The Validate button does change the status (from `extracted` to `valide`), but:
- after validation, no actionable pivot remains on the page ("no transition available
  here") → one must go back through the list;
- the status vocabulary stays English/participle (`valide`); no "correct" nor
  "reject" action clearly beyond the bare minimum;
- functionality to be verified: correcting an extracted value is not guaranteed.

## Expected state (compliant with the FR statuses, TKT-102)
- The detail page of an `À traiter` state offers **Validate / Correct / Reject** in an explicit and
  non-disorienting way.
- **Correct**: allows editing a value (e.g. the due date, an amount misread) without
  full re-entry, then saves; the state becomes "Validée (avec correction)" [Validated (with correction)] or stays to-be-validated
  depending on semantics (to be cleanly defined, transparency: the correction is traced).
- **Validate** → the field moves to `Validée`; the user sees immediate feedback + the possibility to
  go back (no "nothing left available" forcing them to leave the page). At minimum a link/reminder
  to return to the list and the status apparently updated.
- **Reject** → `Rejetée` (+ a label that explains, to be completed).
- Any chosen state **persists after refresh** (NonReg E6).
- The status label in the filters and the list stays consistent (TKT-102/201).

## The persona's "pain"
This is the backoffice operator's everyday action (validation queue). If she cannot
easily correct an extracted value (the control of an "assistant" that makes mistakes), she
falls back into manual re-entry AND loses trust in the tool. The product must remain "the AI
proposes, the human stays in control".

## Acceptance criteria
- [ ] On a "À traiter" detail page, Validate / Correct / Reject actions all present and visible
- [ ] Validate → status "Validée" + immediate feedback; Reject → "Rejetée"
- [ ] Correct allows editing a value and saves without full re-entry; consistent trace/state
- [ ] After the action, the user has a simple way to return to the list (not a "dead" page)
- [ ] The status persists after refresh; consistent with the list and the filters (TKT-201)
- [ ] No JS errors; normative FR labels

## Notes
Completes TKT-201 (list): it provides the business gesture at the detail-page level. Coordinate so that the
back-end exposes the transitions (to process → validated/rejected, correction) cleanly, with FR
labels on the UI side.
