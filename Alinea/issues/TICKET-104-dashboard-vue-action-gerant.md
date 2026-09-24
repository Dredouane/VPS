# Ticket AREV-104 — Dashboard: action-oriented "today" view for the manager (outside the Emails/Invoices spec)

- **Date**: 2026-09-08
- **Spec reference**: consistent with §0, but with visible addition of the product vision (strat/vision_produit) — periphery of the 2 modules
- **NonReg scenarios**: F1, F3 (consistency) — verify that the validation queue is not broken
- **Persona**: Gerant_PME (primary) · Fateh_Ug
- **Priority**: Medium
- **Type**: UX improvement

## Description (the contract)
The manager (decision-maker, judging in 1-2 min) sees at a glance **what requires their action** and
a simple proof of value — not the system's execution logs.

## Current state
A Dashboard mixing a good start (3 KPI cards: Invoices total / Invoices to validate / Emails in
error) with a technical subtitle and above all a **"Derniers runs" [Latest runs]** block (table Run at /
Trigger / Mails new / Docs indexed / Invoices / Errors / Duration, `run_pipeline` rows), useless
for the user.

## Expected state
- Remove the "Derniers runs" [Latest runs] block and the technical subtitle from the manager view.
- Keep/expand the cards into an **action view**: what requires a decision (invoices to
  process, close due dates/unpaid, errors) + a reassuring state when everything is up to date.
- Optional: 1-2 understandable value figures (invoices processed, € of invoices analyzed)
  rather than execution logs.

## The persona's "pain"
The manager drowns in technical operations, cannot identify what they must do nor the
real benefit → they stop using the dashboard.

## Acceptance criteria
- [ ] No technical reference (runs, run_pipeline, trigger, D11, …) visible on the dashboard
- [ ] An "Actions" block (to process / due dates / errors) occupies the main screen
- [ ] A clear positive state when everything is up to date (not an empty page)
- [ ] (Bonus) understandable "value" figure present

## Notes
This ticket does not belong to the core of the 2 modules (Emails/Invoices); it improves the
decision entry point. To be refined once the clean conversation list and validation queue
exist (TKT-101, TKT-106).
