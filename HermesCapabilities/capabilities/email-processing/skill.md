---
name: email-classify
description: >-
  Business classification of the NEW content of a structured email (output
  of thread_parser): category, summary, flags. To run after the
  thread-parser, before expert routing. Never classify the quoted
  history (anti-duplicate).
---

# Skill email-classify

## Role

Categorize the new content of each structured mail and produce the
summary used by expert routing and the RAG.

## Procedure

1. Input: the `thread_parser` output (mails with `rag_status: new`).
2. For each new mail, produce **strictly**:

```json
{"message_id": "<msg@x>", "categorie": "facturation|devis|chantier|admin|autre",
 "resume": "1 sentence", "flags": ["pj-facture", "urgent"]}
```

3. The summary covers the new content only — never the quoted
   history (already in RAG or refused, cf. D3).

## Limits

- The classification commits to nothing: the experts decide downstream
  (`expert-router`).
- Invalid output (missing JSON) → `error` status on the mail (email_upsert)
  and escalation — no silent LLM retry.
