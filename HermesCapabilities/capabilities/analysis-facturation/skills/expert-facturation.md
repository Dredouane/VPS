---
name: expert-facturation
description: >-
  Invoicing expert (Chain of Experts): assembles the full invoicing context
  (email + invoice pre-verified by the C3 amount check) and creates/updates
  the structured data in Supabase via rpc_cap_facture_upsert (status
  extracted — D6). Available for the webApp CRUD and the other agents.
---

# Skill expert-facturation

## Role

Build the most complete structured invoice data possible from the
mail + pre-verified OCR, and make it persist.

## Procedure

1. **Context**: structured mail (C2) + canonical invoice (C3
   `invoice.verdict` — numbers ALREADY verified: sums_ok).
1bis. **D15 — PJ-sourced only**: the invoice is created/updated **ONLY**
   from an invoice attachment (canonical pre-verified OCR). A discussion
   mail without an attachment (reminder, nth forward) = RAG + thread
   **only** — never upsert from text alone (anti-overwriting of processed
   invoices).
2. Matching: `rpc_cap_facture_find(slug, secret, numero, fournisseur)` —
   does it already exist?
3. Upsert: `rpc_cap_facture_upsert(slug, secret, numero, fournisseur,
   identifiant, objet, date_facture, date_echeance, ht, tva, ttc, devise,
   confiance, email_message_id, document_id, extraction)` — status
   `extracted` (D6: human validation = webApp status transition).
4. Record the result in the mail metadata (email_upsert → status
   processed).

## Strict rules

- `numero` missing → NO upsert: record in `pipeline_runs` + flag.
- `sums_ok == false` → upsert anyway (status extracted) BUT reduced
  confidence + `sums_ecart` flag in `extraction` — the human sees the
  discrepancy.
- NEVER touch the `valide`/`paye` status of an existing invoice (the RPC
  already protects it — D6/no demotion).
- Never any direct SQL (RPC only, slug + secret from the env).
