# Ticket AREV-111 — FR Vocabulary: Cleanup of the 4 dev-jargon leftovers (TKT-102 follow-up)

- **Date**: 2026-09-09
- **Spec reference**: `SPEC_Produit_Emails_Factures.md` §0 & §3 (anti-requirements)
- **NonReg scenarios**: A3
- **Persona**: Fateh_Ug · Gerant_PME · Salarie_Backoffice
- **Priority**: Medium (P2)
- **Type**: UX improvement / French localization

## Description (the contract)
All of the product's screens must be labeled in business French, with no technical development terms.

## Current state (4 leftovers observed)
1. **`/login` page**: Paragraph at the bottom of the card `Accès réservé — mapping dans app_users (admin / backoffice / terrain)` [Restricted access — mapping in app_users (admin / backoffice / field)].
2. **`/recherche` page**: Main H1 title `Recherche RAG` (`RAG` = dev jargon).
3. **`/chains` page (Conversations)**: Subtitle `Conversations email (threads Gmail) traitées par le pipeline — vue type inbox` [Email conversations (Gmail threads) processed by the pipeline — inbox-style view].
4. **`/admin` page**: Header `runner D9` + footer note `Supabase / API admin`.

## Expected state
1. `/login`: Replace with a simple sentence such as `Accès réservé aux utilisateurs autorisés.` [Restricted access for authorized users.] (or remove).
2. `/recherche`: H1 title `Recherche` [Search] or `Recherche de documents` [Document search].
3. `/chains`: Subtitle `Vos échanges emails et documents associés` [Your email exchanges and related documents].
4. `/admin`: Remove the terms `runner D9`, `Supabase`, `API admin`.

## Acceptance criteria
- [ ] The 4 targeted texts replaced with business vocabulary
