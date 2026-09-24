# Capability doc-ocr (C3) — multi-provider OCR + two judges

**Type**: `mix` · **Status**: M2.3 — code + tests green (real network at
M2.6 on real attachments)

Extracts the text of every attachment (C1 spool) with **two vision
extractors in parallel** (Gemini Vision + OpenRouter vision), picks
the best one via a **deterministic general judge**, and — only for invoices
— chains an **SLM adapter** (canonical JSON reformat) then an arithmetic
**amount check** (Σ lines == net, net+VAT == gross).

## Components

| File | Role |
|---|---|
| [manifest.yaml](manifest.yaml) | Contract: GEMINI/OPENROUTER secrets, code ×5, skill |
| [decision.md](decision.md) | Two separate judges (01/09 review) — D14 |
| [code/ocr_gemini.py](code/ocr_gemini.py) | Extractor #1 (Gemini Vision, generic) |
| [code/ocr_openrouter.py](code/ocr_openrouter.py) | Extractor #2 (OpenRouter vision, other family) |
| [code/ocr_judge.py](code/ocr_judge.py) | **General judge**: similarity, completeness, doc_type, winner |
| [code/invoice_adapter.py](code/invoice_adapter.py) | **Invoice fork**: SLM Flash → canonical JSON |
| [code/invoice_check.py](code/invoice_check.py) | Normalization (aliases, FR/EN numbers) + **amount check** |
| [schemas/invoice_extraction.json](schemas/invoice_extraction.json) | Versioned canonical invoice schema |
| [soul-addendum.md](soul-addendum.md) | Refusals: inventing values, hiding a discrepancy, check outside invoices |
| [tests/test.sh](tests/test.sh) | Pure unit tests (judge, numbers, sums, adapter) |

## Required secrets (in `HermesConfig/clients/<slug>/client.env`, 600)

| Variable | Role |
|---|---|
| `VPS_GEMINI_API_KEY` | Vision #1 + Flash adapter (SUREN_VPS_GEMINI_API_KEY value reusable) |
| `VPS_OPEN_ROUTER_API_KEY` | Vision #2 (SUREN_VPS_OPEN_ROUTER_API_KEY value) |

Env: `OCR_OPENROUTER_MODEL=openai/gpt-4o-mini`, `OCR_INVOICE_TOLERANCE=0.02`.

## Architecture points (D14)

- Extractor output is **generic** (`{text, doc_type_hint, confidence}`) —
  no invoice schema imposed on transcription.
- General judge = pure code, **always**; amount check = **fork only** if an
  invoice is detected (majority hints + heuristics).
- The SLM adapter reformats but **never judges** — its output is
  re-validated by the code; invalid reformat → `sums_ok: null`.
- `sums_ok: false` ≠ failure: discrepancy reported + reduced confidence, the
  human decides in the webapp (D6).

## Costs / quotas

2 vision calls + (if invoice) 1 Flash call per attachment. Low-cost models
(flash/4o-mini). To watch as volume grows — quotas per client.env.

## History

- 2026-09-01: creation (M2.3) — design revised during team grind: two
  separate judges (general / amounts), extractor #2 OpenRouter, SLM
  adapter plugged onto the invoice fork.
