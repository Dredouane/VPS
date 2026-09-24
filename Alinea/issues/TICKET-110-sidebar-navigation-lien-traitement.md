# Ticket AREV-110 — Sidebar Navigation: Fix the Traitement link and route

- **Date**: 2026-09-09
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §0 & §3
- **NonReg scenarios**: Nav1
- **Persona**: Salarie_Backoffice · Gerant_PME · Fateh_Ug
- **Priority**: Medium (P2)
- **Type**: Navigation / Routing bug

## Description (the contract)
Each item of the side navigation (Sidebar) must point to its own view with no duplicate and no 404 error.

## Current state
- In the sidebar, the tab named `Traitement` [Processing] has `href="/emails"`, which is an exact duplicate of the `Emails` item (which also points to `/emails`).
- Typing the URL `/traitement` directly in the address bar returns a **404 Next.js** error page.

## Expected state
- Either the `Traitement` item points to a real view for monitoring processing/flows,
- Or the duplicate item is removed from the navigation if the view does not exist.

## Acceptance criteria
- [ ] No navigation link points to a route identical to another link
- [ ] No sidebar link produces a 404 error
