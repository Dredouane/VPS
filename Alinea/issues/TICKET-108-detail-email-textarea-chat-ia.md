# Ticket AREV-108 — Email Detail: Implement the AI Chat input area on the conversation

- **Date**: 2026-09-09
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §1.2 (the assistance chat — signature feature)
- **NonReg scenarios**: C4, C5, C6, C7
- **Persona**: Salarie_Backoffice (primary) · Gerant_PME
- **Priority**: High (P1)
- **Type**: Bug / Feature completeness

## Description (the contract)
On the email conversation detail page (`/chains/[id]`), the conversation-assistance chat must let the user **ask a question** about the exchange.

## Current state
On the `/chains/[id]` page, there is **no input area** (`textarea` / `input`) and no submit button to ask a question. The text field is entirely absent from the view (0 `input`/`textarea` elements present in this page's DOM).

## Expected state
- An AI chat component present on the conversation detail page `/chains/[id]`.
- An input field (`textarea` or `input` with placeholder "Votre question sur cette conversation..." [Your question about this conversation...]) + a submit button.
- Submitting a question adds the user bubble and generates a sourced answer (citing the conversation's messages/attachments).
- The chat history on the conversation is persistent after a reload (refresh).

## Acceptance criteria
- [ ] A usable text input field is present on `/chains/[id]`
- [ ] Submitting a question displays the assistant's answer along with its sources
- [ ] Questions/answers remain visible after a refresh (F5)
