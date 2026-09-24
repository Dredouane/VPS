# Ticket AREV-101 — Conversations view (`/chains`): fix stability AND display a list of conversations

- **Date**: 2026-09-08
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §1.1 (list of conversations / mailchains)
- **NonReg scenarios**: B1, B2, B6 (and A5)
- **Persona**: Salarie_Backoffice (primary) · Gerant_PME
- **Priority**: High
- **Type**: Bug + UX improvement

## Description (the contract)
The "Conversations" view (route `/chains`, menu "Chaînes") is THE entry point of the Emails
module. It must be **stable** (never an error screen) and display a **list of
mailchains**, one per conversation thread — not an empty page nor dumped emails.

## Current state
- The view is **unstable**: from one load to the next, it alternates between the technical
  screen "This page couldn't load" (JS exception) and an empty page (only the title, no content,
  DOM with no usable `<main>`). Replayed several times: reproducible intermittent crash.
- Even when it does not crash, it shows nothing readable for a user.

## Expected state
- `/chains` loads **deterministically** (10 loads with no crash and no empty page).
- The view presents a **list of conversations (mailchains)**, each with: sender(s),
  subject (cleanly truncated), useful preview, date/time received, FR status.
- If there is no data: a **clean and helpful empty state** in French ("Aucune conversation pour
  le moment" [No conversations for now]), never a technical screen nor a silent page.
- No JS errors in the console on this route; back-and-forth navigation (list ↔ detail)
  works without loss or crash.

## The persona's "pain"
The backoffice employee and the manager hit an error screen in English or an empty page
at random. Impression of a broken product → immediate distrust, abandonment. This was the
"everyday" core of the product, unusable.

## Acceptance criteria
- [ ] `/chains` loads deterministically (10 attempts with no crash and no empty page)
- [ ] A list of conversations displays with the right descriptors (subject, sender, date, preview)
- [ ] No row has an empty key field without explanation (if empty → guiding label)
- [ ] Possible empty state: FR message + CTA/action idea
- [ ] No console JS errors; working list↔detail back-and-forth
- [ ] NO English technical error screen encountered anymore on this path

## Notes
Foundation of the Emails module: we build the conversation list BEFORE the thread detail
(see TKT-108). Builds on the mailchain data already present server-side (the "Fwd:
Facture situ MARS 26" thread conceptually exists in AREV).
