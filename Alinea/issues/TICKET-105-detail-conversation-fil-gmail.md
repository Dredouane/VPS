# Ticket AREV-105 — Conversation detail: "Gmail-style" vertical thread + attachments

- **Date**: 2026-09-08
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §1.2 (Gmail thread)
- **NonReg scenarios**: C1, C2, A4
- **Persona**: Salarie_Backoffice (primary) · Gerant_PME
- **Priority**: High
- **Type**: UX improvement / conversation detail redesign

## Description (the contract)
A conversation's detail displays as **a familiar mailbox (Gmail)**: a vertical thread of
messages in chronological order, readable and professional. The user recognizes the
pattern without training.

## Current state
The detail (e.g. on the "Fwd: Facture situ MARS 26" thread) shows raw bodies mixed with internal
technical notes ("Pas encore de résumé (classification branchée en M2.6-bis)" [No summary yet (classification wired in M2.6-bis)],
empty Classification/Received/Meta date fields, "Contenu extrait" [Extracted content] dumped as one block). No
Gmail-style thread presentation.

## Expected state
- Each email in the thread = a **distinct block**: sender (name + avatar/initial), date/time,
  formatted body (line breaks, traps hidden in the signature masked if possible), reader for
  forwarded messages ("Fwd:" displayed as forwarded content).
- Replies **stack in order** from oldest to newest.
- **Attachments** = clickable thumbnails (name, type, size) that open a **preview** (not a
  forced download); no preview → helpful message + download still possible.
- The **internal technical notes** ("M2.6-bis", mechanism explanations) are removed from
  what is shown to the user.
- A button/nothing broken: access is from the conversations list (TKT-101) and the back
  navigation works (A4).

## The persona's "pain"
The backoffice operator wants to read an exchange like in her usual mailbox to
understand quickly; raw blocks and roadmap phrases disorient her and cost her
trust.

## Acceptance criteria
- [ ] The thread displays messages as distinct ordered blocks (Gmail-like)
- [ ] Name + avatar + date visible on each block; forwards recognizable
- [ ] Attachments open in preview (or helpful message + download)
- [ ] No M2.6-bis / LLM / mechanism mention in the UI
- [ ] Access from the list + back navigation without loss; no JS errors

## Notes
Built after TKT-101 (list). Next versions: integrate the real classification/statuses
(covered by TKT-102 vocabulary) and the side panel + chat (TKT-106/110).
