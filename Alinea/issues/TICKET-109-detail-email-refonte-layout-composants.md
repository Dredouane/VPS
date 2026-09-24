# Ticket AREV-109 — Email Detail: Redesign of the component layout (Layout & Rendering)

- **Date**: 2026-09-09
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §1.2 (the "augmented Gmail" vision)
- **NonReg scenarios**: C1, C2, C3
- **Persona**: Salarie_Backoffice (primary) · Gerant_PME · Fateh_Ug
- **Priority**: High (P1)
- **Type**: UX/UI redesign / Display quality

## Description (the contract)
An email conversation detail page (`/chains/[id]`) must offer a smooth, sober and professional reading experience in the "augmented Gmail" style, not a raw display of database data.

## Current state
1. **Redundant side cards**: The right column shows two cards that repeat each other ("En résumé" [In summary] re-displays `Factures liées: 2026-163` [Linked invoices: 2026-163], followed by the "Factures liées (1)" [Linked invoices (1)] card which re-displays exactly the same invoice).
2. **Unstructured header**: The participants' email addresses are displayed as unstructured plain text (`REDACTED_EMAIL, REDACTED_EMAIL Dernier : 06/09/2026` [Last: 06/09/2026]).
3. **Uncleaned email body**:
   - Raw image alt tags present (`[image: Titre : Mobile - Description : mobile-icon]` [image: Title: Mobile - Description: mobile-icon]).
   - Outlook forwarding headers displayed as plain text in the middle of the body (`*De :* MAHMOOD MOHSAN` [From:], `*Envoyé :* lundi 30 mars...` [Sent: Monday, March 30...]).
   - Duplicated, non-collapsed email signatures.
4. **Attachment thumbnail**: Buried inside the email body instead of being highlighted in a dedicated attachment component/section.

## Expected state
- **Clean layout**: A clear main thread on the left (or centered) and a synthetic side panel on the right with no duplicate.
- **Masking / Collapsing**: Collapse by default forward quotes ("From:", "Sent:") and repetitive signatures.
- **Text cleanup**: Remove raw renderings of broken image tags (`[image: Titre...]`).
- **Attachment component**: Highlight the attachment thumbnail (name, PDF type, size, Open button) in a dedicated area of the email.

## Acceptance criteria
- [ ] Duplicate cards removed from the side panel
- [ ] Collapsing / cleanup of signatures and raw forwarding headers
- [ ] Clean highlighting of the PDF attachment thumbnail
