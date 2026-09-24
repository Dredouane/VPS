# Ticket AREV-103 — Root page `/`: clean entry point (no technical placeholder)

- **Date**: 2026-09-08
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §3 (anti-requirements: no dev mention / no dead button)
- **NonReg scenarios**: A2
- **Persona**: Fateh_Ug (primary) · Gerant_PME
- **Priority**: Medium
- **Type**: UX improvement

## Description (the contract)
Every visitor who opens the root URL (before login) must see a sober, user-oriented page
→ leading to a real login. No development content.

## Current state
The root `/` displays a dev placeholder: badges "P0 scaffolding", "P1 contrats" [contracts], text
"Auth, factures, emails et recherche RAG arrivent en P3/P4. L'API est contractée par
openapi/openapi.yaml, généré depuis le SQL" [Auth, invoices, emails and RAG search arrive in P3/P4. The API is contracted by openapi/openapi.yaml, generated from the SQL], and a **"Connexion (P4)" [Login (P4)] button, disabled**.

## Expected state
- `/` displays NO badge/milestone nor technical reference (openapi, SQL, P0-P4, …).
- Access leads to a functional login: either a redirect to `/login`, or a
  clean landing page with an active **"Se connecter"** [Log in] button that leads to `/login` (and, optionally,
  a simple value phrase for the target user).

## The persona's "pain"
A prospect / an advisor discovering the product through the root sees "an unfinished
product", a dead button → they close it. Demo / discovery case wasted from the very first page.

## Acceptance criteria
- [ ] `/` with no technical badge/text (P0-P4, openapi, SQL, …) and no disabled button
- [ ] The root leads (via redirect or active button) to a real login page
- [ ] Clean rendering, no error screen

## Notes
Entry screen visible before any login (to be polished for the "passable demo" in front of Fateh).
