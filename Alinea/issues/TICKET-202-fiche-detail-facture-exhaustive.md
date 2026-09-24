# Ticket AREV-202 — Invoices module: exhaustive detail page (all extracted values + origin mailchain link)

- **Date**: 2026-09-08
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §2.2 (Invoice detail page, zones A+B)
- **NonReg scenarios**: E1, E2, E4, E5 (and D5 opening)
- **Persona**: Salarie_Backoffice (primary) · Gerant_PME
- **Priority**: High
- **Type**: UX improvement / completeness of the detail page

## Description (the contract)
An invoice's detail page is the **workstation** of the backoffice operator: there she sees
ALL the extracted values (to validate/correct), the **explained confidence**, the source PDF
document, and the **origin mailchain** in one link — to verify and trust.

## Current state
The detail page already shows some fields (Fournisseur, Identifiant fourn., Objet, Date, HT/TVA/TTC [Supplier, Supplier ID, Subject, Date, net/VAT/gross],
"Confiance extraction 69 %" [Extraction confidence 69 %], raw source email). Missing completions per the spec: unreadable source
email, VAT "0.00", no "à compléter" [to be completed] (missing due date), no direct PDF
preview nor an explicit and understandable link to the source mailchain.

## Expected state
- **Zone A — exhaustive data**, cleanly presented: N°, Fournisseur + SIRET [Supplier + SIRET], Objet, dates
  (invoice AND **due date**), Recipient / ordering party, HT / VAT (amount + rate) / TTC in
  FR format, client number if present. Attention emoji on missing/doubtful fields → "à
  compléter" + a way to correct on the spot.
- **Confidence presented and EXPLAINED** ("69 % — à vérifier : échéance absente" [69 % — to verify: due date missing]), never a bare %.
- **Source PDF openable in preview** from the detail page (thumbnail/PDF).
- **Zone B — provenance / mailchain link** (fundamental, polished): an explicit block showing the
  chain `email received (date) → attachment read → data extracted`, with a clickable link to the
  original conversation (the Gmail thread TKT-105). The operator must be able to verify that the extraction
  comes from the right email and that the link is correct.

## The persona's "pain"
Without seeing all the values and the provenance proof, the operator cannot validate with
confidence → either she re-verifies blindly (time loss), or she validates wrongly (accounting
risk). The email↔invoice link is what builds trust in the automatic extraction.

## Acceptance criteria
- [ ] All values listed in "Expected state" are displayed (those present) with no mute empty
      form: missing/doubtful fields are flagged "à compléter"
- [ ] The amount is in FR format; no "0.00"
- [ ] The confidence includes a sentence explaining the doubts
- [ ] Source PDF openable (preview) at least when present in AREV
- [ ] Provenance block visible + clickable link to the original conversation (round trip works)
- [ ] No technical mention (D6/extracted/…); normative vocabulary (TKT-102)

## Notes
Two strong aspects: field completeness (for validation) and the back link to the thread
(trust). Builds on TKT-105 (Gmail thread) for the back link. Does NOT implement the chat
yet (that is TKT-203) but reserves the space for a question zone.
