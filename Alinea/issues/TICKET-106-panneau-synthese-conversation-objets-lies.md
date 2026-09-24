# Ticket AREV-106 — Conversation detail: summary side panel + linked business objects

- **Date**: 2026-09-08
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §1.2 (summary side panel)
- **NonReg scenarios**: C3 (and C7 isolation)
- **Persona**: Salarie_Backoffice · Gerant_PME
- **Priority**: Medium
- **Type**: UX improvement

## Description (the contract)
Next to the conversation thread, a **side panel** gives an immediate summary and links
the exchange to the **business objects** (linked invoices, supplier, case file). The user understands the
situation without reopening each email, and can leave the conversation with one click toward the
data.

## Current state
No conversation summary panel: the summary fields are absent or shown bare
(fields "Classification / Reçu le / Date meta" [Classification / Received on / Meta date] set to "—", no linking to objects).

## Expected state
- Side panel/zone on the detail, displaying without jargon: main sender, useful participants
  (some of which may be masked if they are traps), start date of the exchange,
  **readable classification** (Invoice / Quote / Reminder / Other), FR status.
- **Linked business objects** displayed and clickable as soon as they exist: e.g. "Facture 2026-163"
  → leads to the invoice detail page of the Invoices module (email↔invoice coupling established).
- If an object is not (yet) linked, honestly display "Aucune facture liée" [No linked invoice] (in the useful
  sense) rather than a mute empty field.

## The persona's "pain"
The user must be able to say in 5 seconds "what is this thread about and what came out of
it" (especially if an invoice came out of it) without digging through the text. This anchors trust:
"the system did attach my invoice to this thread".

## Acceptance criteria
- [ ] A summary panel visible on the conversation detail
- [ ] Useful participants / date / classification / status readable, no jargon nor mute "—" field
- [ ] Every linked business object (invoice…) displayed + clickable toward the relevant module
- [ ] Absence of object: helpful FR message (not an empty field)
- [ ] Consistency with the normative vocabulary (TKT-102)

## Notes
The "email ↔ invoice" coupling displayed here prepares the invoice detail page with its back link
to the mailchain (TKT-202). Take care that the panel stays sober so it does not duplicate
the thread.
