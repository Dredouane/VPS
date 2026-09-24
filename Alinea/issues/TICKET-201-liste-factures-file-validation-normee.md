# Ticket AREV-201 — Invoices module: list = normative validation queue (FR statuses, counter, FR format)

- **Date**: 2026-09-08
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §2.1 (invoice lists, FR statuses, counters)
- **NonReg scenarios**: D1, D2, D3, D4, D6
- **Persona**: Salarie_Backoffice (primary) · Gerant_PME
- **Priority**: High
- **Type**: UX improvement

## Description (the contract)
The "Invoices" view is a **readable validation queue** for the operator and a **steering
register** for the manager. Gender-agreed French statuses, well-formatted amounts, a useful counter —
no longer a raw technical table.

## Current state
Table with correct columns (Numéro/Fournisseur/Objet/Échéance/TTC/Statut [Number/Supplier/Subject/Due date/TTC/Status]) BUT: filters
"valide/rejete/paye/archive" ("doubtful participles, lowercase"), entry status `extracted`
(English) not covered by any filter, amounts "60226.08 EUR" (decimal point, weird spacing) and empty
due-date field. Technical subtitle ("…pipeline — transition de statut (D6)" [status transition (D6)]).

## Expected state
- **Normative FR statuses** on rows and filters (compliant with TKT-102): `À traiter` (that is the
  entry status of extractions, never again `extracted` displayed) · `Validée` · `Rejetée` ·
  `Payée` · `Archivée`.
- **Visible counter** of "X à traiter" [X to process] at the top (orients the action).
- **Each row**: N°, Fournisseur [Supplier], Objet [Subject] (cleanly truncated), Date, **Échéance** [Due date], **Montant
  TTC format FR** [FR-formatted gross amount] (`60 226,08 €`, decimal comma, thousand space), Status (consistent badge).
- Missing due date → guiding label "à compléter" [to be completed] (not a mute "—") leading back to the detail page.
- Subtitle as a value-oriented sentence (no D6/pipeline).

## The persona's "pain"
Without a clear queue, the operator does not know what to validate in priority nor sometimes how; the manager
does not see the volume to process nor readable amounts. Format and jargon kill usage.

## Acceptance criteria
- [ ] Displayed filters AND statuses use the normative FR labels (À traiter/Validée/Rejetée/Payée/Archivée)
- [ ] The entry status displays as "À traiter" (no `extracted`/`valide`/`rejete` visible)
- [ ] "X à traiter" counter visible
- [ ] Due date column: value OR "à compléter" (never a mute "—")
- [ ] Amounts in FR format; consistent amounts across all rows
- [ ] Subtitle without jargon; no D6/pipeline mention
- [ ] Opening a row → the invoice detail page (TKT-202)

## Notes
Depends on the vocabulary standard (TKT-102): do TKT-102 first then apply here. The
"À traiter" consistency between dashboard (counter) and list is desired.
