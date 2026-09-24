# Decision — Capability doc-ocr (C3)

> Order of rule: **NATIVE > MIX > SIDECAR** (ARCHITECTURE.md §2).
> 01/09 revisions: two separate judges (user review) + extractor #2.

## Need

Extract the text from ALL attachments (invoices, plans, reports, photos,
letters — not just invoices), make the extraction reliable by comparing
two providers, and verify invoice arithmetic (Σ lines == net,
net+VAT == gross) without ever inventing a value.

## Options evaluated

| Option | Verdict |
|---|---|
| **Mix**: 2 vision extractors (Gemini + OpenRouter — different families) + **2 separate judges** (general code / amounts code on fork) + SLM Flash adapter (invoice branch) | ✅ **kept** |
| A single extractor | ❌ no cross-reliability |
| Two Gemini calls | ❌ same family = insufficient diversity |
| A single judge merging quality + amounts | ❌ mixes responsibilities (user review 01/09) |
| Invoice schema imposed on all documents | ❌ extraction is generic; the schema comes in ONLY on the invoice fork |
| Tesseract sidecar | ❌ low quality on photos, one more container |

## Decision

**MIX** — two-judge architecture (D14):

1. **General judge** (always, pure code): token-overlap similarity between
   the 2 transcriptions, completeness, confidence ×2, doc_type (extractor
   majority hints + word/amount heuristics), winner.
   Strong disagreement → `low_agreement` + reduced confidence (never blocking).
2. **Invoice fork** (if doc_type == invoice):
   **Gemini Flash** adapter — winning text → canonical invoice JSON
   (`schemas/invoice_extraction.json`) — then **amount check** (pure code):
   Σ lines == net, net+VAT == gross (±0.02). Invalid reformat = `sums_ok null`
   (no check, no invention). Result annotated for the C6 expert.

Existing keys reused: `VPS_GEMINI_API_KEY` (vision #1 + adapter) and
`VPS_OPEN_ROUTER_API_KEY` (vision #2, different family) — already present in
the VPS secrets. Extractor plan B: Tesseract sidecar (quality/complexity
— set aside unless a stronger-privacy need arises).

## Re-check

| Date | Hermes | Verdict unchanged? | Notes |
|---|---|---|---|
| 2026-09-01 | v0.20.6 | — (initial decision) | two-judge design + fork |
