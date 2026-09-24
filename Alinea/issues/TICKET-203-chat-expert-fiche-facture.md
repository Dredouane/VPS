# Ticket AREV-203 — Invoices module: dedicated assistant expert of the detail page + linked data

- **Date**: 2026-09-08
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §2.2 (Zone C — the chat dedicated to the invoice)
- **NonReg scenarios**: E7 (and C6/C7 as honesty and isolation principles)
- **Persona**: Salarie_Backoffice (primary) · Gerant_PME
- **Priority**: Medium
- **Type**: New feature (signature feature of the Invoices module)

## Description (the contract)
Each invoice detail page has a **contextual assistant** that answers with knowledge of the VISIBLE
detail page and of the **data points linked** to the invoice (origin emails, supplier, projects/side jobs,
actions). It is the connecting thread that evolves the product toward an "expert of the case file", and the
extension of the conversation chat (TKT-107).

## Current state
No assistant dedicated to an invoice. The product does not yet link the detail page to neighboring data
(emails, projects). The user must fall back on manual searches for any interpretive question.

## Expected state (definition of done)
An assistant (panel/question zone) accessible on the detail page that:
1. Understands **the displayed detail page** (the extracted values seen on screen) + the **linked data
   points** available on the data side (origin mailchain(s), supplier, ongoing work/project, actions).
2. Answers in natural language interpretive and factual questions about THE invoice and its
   case file, citing/referencing the source (the detail page, an email, a linked doc).
3. Honestly admits when an info is not available ("I don't have this data") rather than
   inventing (principle C6).
4. Stays **isolated to the current case file** — never mixes another invoice/client (C7).
Examples of target questions: "Which email does this invoice correspond to?", "Which construction site is it
linked to?", "Who was the contact of the ordering party?", "The net amount seems odd, can you
reread the PDF?".

## The persona's "pain" (value)
It is the extension of the promise "the AI understands the case file". For the operator: answering the
manager's or a third party's questions without loading 3 tools. For the manager: querying the
accounting/case-file situation at a glance. This is what makes an invoice "explained", not just
"entered".

## Acceptance criteria
- [ ] Assistant access from the invoice detail page (consistent with TKT-107 if the pattern is reused)
- [ ] A factual question about the visible detail page → exact answer with arguments from the detail page
- [ ] A question about the linked data (origin email, construction site) → right answers when they
      exist, "not available" otherwise, never invented
- [ ] Isolation per invoice/client verified (2 distinct detail pages → no contamination)
- [ ] No JS errors; normative vocabulary combo

## Notes
Builds on the "sourced chat" foundation (TKT-107), the email↔invoice link (TKT-202) and, eventually, the
business objects (projects/actions) as they come into existence. Vision: this assistant becomes
the expert of the complete case file as the data points get richer.
