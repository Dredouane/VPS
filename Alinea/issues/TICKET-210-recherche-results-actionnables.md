# Ticket AREV-210 — Search: results become actionable (open the resource / go to the object)

- **Date**: 2026-09-08
- **Spec reference**: consistent with §1/§2 (every result must lead to the relevant business object) — complement of the 2 modules
- **NonReg scenarios**: (cross-cutting) — consistency of the back navigation without breakage
- **Persona**: Salarie_Backoffice (primary) · Gerant_PME
- **Priority**: Medium
- **Type**: UX improvement

## Description (the contract)
The semantic search (already of excellent quality) makes it possible to find the right info **and to
access it**: each result leads, in one click, to the resource (invoice detail page, email/document thread).

## Current state
The search answers a query well: we get 2 results (e.g. the PDF "FACTURE N° 2026-163…
.pdf", the thread "Fwd: Facture situ MARS 26") with the score. But the results are **not
clickable**: no link or "open" button leads to the detail page or the thread. The user
finds the info but cannot use it in the interface.

## Expected state
- Each result is **clickable/linkable** to the right object:
  - a PDF/invoice → leads to the **invoice detail page** (TKT-202) if the object is linked;
  - an email/emailchain → leads to the **conversation thread** (TKT-105);
  - possible option: the result title is a link + an explicit action button.
- Once opened, the back navigation works (no context loss).

## The persona's "pain"
Quickly finding a document (search), viewing it/acting on it without going back into another menu,
is a big time saver for the backoffice. Otherwise the search (good feature) remains "half
exploitable" and the user goes back to another navigation.

## Acceptance criteria
- [ ] Each result type has an open action (detail page / thread / doc)
- [ ] The click leads to the right resource without error; going back is possible
- [ ] Consistency: result/object labels respect the FR vocabulary (TKT-102)
- [ ] No JS errors

## Notes
Builds on the "mailchain ↔ invoice" link that will be established (TKT-202). To be done after the
routable business objects (detail page, thread).
