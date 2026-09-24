# Ticket AREV-107 — Emails module: "ask a question" assistant (sourced chat) on a conversation

- **Date**: 2026-09-08
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §1.2 (the assistance chat — signature feature)
- **NonReg scenarios**: C4, C5, C6, C7
- **Persona**: Salarie_Backoffice (primary) · Gerant_PME
- **Priority**: Medium
- **Type**: New feature

## Description (the contract)
Each conversation has a **contextual assistant** (popup/panel) that helps the user
understand the exchange and act, answering questions **about that thread**, citing its sources. It is
one of the product differentiators.

## Current state
No questioning capability on a thread: the rest of the front offers neither a useful summary nor a
way to ask questions (the "M2.6-bis" mentiones point to an unwired summary, /chains
crashes). Nothing actionable on the conversation side.

## Expected state (definition of done)
The assistant panel, openable from a conversation's detail, offers:
1. **A summary of the situation** in 1-3 readable lines (e.g. "AR confirmed, an attached invoice
   awaits validation" + status of that conversation).
2. **A pre-drafted reply proposal** (sober tone of the SME) ready to be copied/adapted.
3. **A "Posez une question" [Ask a question] field**: the agent replies using the content OF the current thread, citing
   the emails that support the answer (trace).
Behavioral constraint:
- Question whose answer is in the thread → correct, referenced answer (C5).
- Question OUTSIDE the thread content → the agent honestly answers it does not have the info, without inventing (C6).
- **Strict isolation** to the current thread: never an answer coming from another conversation/client (C7).

## The persona's "pain" (value)
The operator and the manager do not want to reread raw exchanges to find an info or
know what to answer. An assistant that summarizes + answers + proposes an answer fulfills the central
promise "the AI reads, sorts and reports" and positions the human as supervisor.

## Acceptance criteria
- [ ] Assistant access from the detail (clear button/tab) / overlays on the thread without breaking
- [ ] Useful summary (1-3 lines) + reply proposal presented
- [ ] Working question field; the answer cites the source emails when it is in the thread
- [ ] Outside content → honest answer "I don't have the info" (no hallucination)
- [ ] Isolation: test with 2 distinct conversations → no contamination ever
- [ ] No JS errors; compatible with the side panel (TKT-106) and vocabulary (TKT-102)

## Notes
Builds on the conversational/QA RAG backend; verify it is isolated per mailchain (see
REFERENCE C7). This ticket sets the "sourced chat" pattern later reused for the invoice
(TKT-203).
