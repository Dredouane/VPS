---
name: ocr-attachments
description: >-
  Multi-provider OCR extraction of spool attachments (Gemini Vision +
  OpenRouter vision in parallel), deterministic general judge, invoice
  fork (SLM adapter + amount check). To run on every pipeline email
  attachment before embeddings/RAG.
---

# Skill ocr-attachments

## Role

Get the BEST possible extraction of each attachment, with a transparent
verdict (scores, arithmetic sums) — for every type of document, not just
invoices.

## Procedure (per spool attachment)

1. Run the two extractors **in parallel** (same inputs, independent generic
   outputs):

```bash
python3 /opt/data/code/doc-ocr/ocr_gemini.py <attachment> > ex-gemini.json
python3 /opt/data/code/doc-ocr/ocr_openrouter.py <attachment> > ex-openrouter.json
```

2. General judge (deterministic):

```bash
python3 /opt/data/code/doc-ocr/ocr_judge.py ex-gemini.json ex-openrouter.json
```

3. If `doc_type == "facture"` **only**:

```bash
python3 /opt/data/code/doc-ocr/invoice_adapter.py <winning-text.txt> > invoice.json
python3 /opt/data/code/doc-ocr/invoice_check.py invoice.json > invoice-verdict.json
```

4. Keep the full verdict (winner, scores, sums_ok, audit) in the document
   metadata before RAG (C4) — never a rewritten value.

## Limits

- A document not tagged as invoice gets **no** amount check (D14).
- `sums_ok: null` = not verifiable (missing fields / invalid reformat) —
  it is not a failure, it is an absence.
- API keys via the environment only — never as an argument.
