---
name: expert-router
description: >-
  Chain of Experts — router: determines whether a structured email
  concerns one of the registered experts (facturation, ...) and returns the
  strict JSON list. NEVER execute an expert directly — return the list
  for orchestration.
---

# Skill expert-router

## Role

Decide, for each structured email (C2/C3 output), which experts are
concerned. First delivered expert: facturation.

## Procedure

1. Inputs: structured mail (C2: role, new_content, classification,
   attachments) + OCR verdict (C3: doc_type, invoice verdict).
2. Produce STRICTLY:

```json
{"experts": ["facturation"], "confidence": 0.0, "reason": "1 phrase"}
```

## Facturation criteria (deterministic, M2)

- `doc_type == "facture"` (C3 general judge) → facturation expert.
- OR classification category == facturation AND (invoice attachment OR
  invoice/numero/VAT keywords in the new content).

## Limits

- Empty list = no expert (mail indexed in RAG, nothing more).
- The router does NOT decide on amounts — it routes.
