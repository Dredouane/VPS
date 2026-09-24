# Ticket AREV-102 — User vocabulary: remove all technical jargon from the interface

- **Date**: 2026-09-08
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §0 (principle) + §3 (anti-requirements)
- **NonReg scenarios**: A3 (term sweep across all views)
- **Persona**: Fateh_Ug · Gerant_PME · Salarie_Backoffice
- **Priority**: High
- **Type**: UX improvement

## Description (the contract)
The whole product reads in business French. Developer-internal vocabulary (English
statuses, execution mentions, milestones, technical names) disappears from ALL user views.

## Current state
Exposed on multiple screens: statuses in English (`extracted`, `received`, `processed`,
`error`, `run_pipeline`, `active`), technical subtitles ("Pipeline email → facturation
(silencieux, consultation D11)" [silent, D11 consultation], "Extractions du pipeline — validation humaine par transition
de statut (D6)" [Pipeline extractions — human validation via status transition (D6)], "Registre de traitement du pipeline (statuts, retries, erreurs)" [Pipeline processing register (statuses, retries, errors)], "Recherche
sémantique … documents indexés … OCR" [Semantic search … indexed documents … OCR], "Registry clients (runner D9, lecture)" [Client registry (runner D9, read-only)]), roadmap
references ("P3/P4", "M2.6-bis", "classification wired in M2.6-bis").

## Expected state
- Statuses and filters in **French, gender-agreed, explicit** and **identical from one screen to the next**
  (see the contractual normative list in the expected-state section below).
- Removed / reworded: any mention of pipeline, run/runs, runner, retries, D6/D9/D11, P0-P4, Mx,
  registry, OCR, openapi, Supabase, "status transition", "silent".
- Subtitles become value-oriented sentences (e.g. "Factures extraites
  automatiquement, à valider" [Invoices automatically extracted, awaiting validation]) — never an explanation of the computing mechanism.
- **Normative status list** (to be followed everywhere):
  - Invoices: `À traiter` (entry state, e.g. `extracted`) · `Validée` · `Rejetée` · `Payée` · `Archivée`
  - Conversations/Emails: `Non lu` · `À traiter` · `Traitée` (an error = `En erreur` + visible ⚠)
  - These labels are DISPLAYS; the backend may keep its underlying codes.

## The persona's "pain"
Incomprehensible words = a "unfinished" product in the mind of the manager, the operator and the
advisor. Fateh cannot show a screen that "speaks code". Jargon kills trust
and adoption.

## Acceptance criteria
- [ ] Sweep of ALL views: zero occurrences of the terms listed above
- [ ] Every displayed status uses an FR label from the normative list (gender-agreed, explicit)
- [ ] A given label (e.g. "À traiter") is consistent no matter the view
- [ ] No interface file contains a sentence explaining a technical mechanism to the user

## Notes
To be distinguished from module tickets (statuses in the Invoices list = TKT-106). Do a component
sweep after the change to check A3 of the REFERENCE.
