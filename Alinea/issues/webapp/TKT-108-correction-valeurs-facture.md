# TKT-108 — Correcting an invoice's values (detail page edit mode)

> Webapp ticket (Alinea session) — format modeled on `../template_issue.md`,
> without spec/NonReg reference (outside scope).

- **Date**: 2026-09-08
- **Persona**: Salarie_Backoffice
- **Priority**: High (V2)
- **Type**: New feature (architect decision D-B)

## Description (the contract)
On an invoice's detail page, the operator can **correct or fill in missing
fields** (due date, amounts, subject, supplier…) using the detail page's normal
edit mode — without full re-entry. The correction is traced.

## Current state
The detail page is read-only + status transitions (Validate/Reject).
Wrong or missing values (e.g. missing due date) cannot be
corrected in the tool.

## Expected state
- **Modifier** [Edit] button on the detail page → editable fields (inline edit mode) →
  Enregistrer [Save] / Annuler [Cancel].
- Editable fields: `date_facture`, `date_echeance`, `montant_ht`,
  `montant_tva`, `montant_ttc`, `objet`, `fournisseur`,
  `fournisseur_identifiant`, `devise`. Not editable: `numero`, `statut`
  (dedicated transitions), system fields.
- Each save traces in `extraction` (jsonb): timestamp, author's
  email, field, old value → new value (readable audit).
- The status is NEVER modified by the edit (never `extracted` — D6
  guard already in place API-side).

## Acceptance criteria
- [ ] Modifier [Edit] → inline edit → Enregistrer [Save] → values persisted (refresh OK)
- [ ] Correction audit visible (who, when, what)
- [ ] Editable fields = only the list above (API refuses the rest)
- [ ] No status modified by the edit
- [ ] FR format on the edited amounts (validation)

## Notes
Backend: `PATCH /api/v1/factures/{id}` extended (pickFacturePatch →
pickFactureUpdate: status OR business fields, never both in the same
call). Openapi contract regenerated (gen-all). See PLAN-ITER-001.md §2 (D-B).
