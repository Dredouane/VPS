# PLAN-ITER-001 — Fusion of webapp findings ⇄ UX tickets

> **Author**: opencode webapp session (Alinea). Date: 2026-09-08.
> **Status**: validated by the architect (decisions D-A/D-B/D-C + LLM chat).
> This document MERGES the technical findings of the webapp session with the
> UX tickets of the parent folder (`Alinea/issues/TICKET-*.md`). It fixes
> the REAL state of the product (what already exists) and the execution order.
> The product tickets remain the reference for the WHAT; this plan adds the
> how, the root causes and the pipeline dependencies.

---

## 1. Verified real state (before assuming everything must be built)

| Item | Real state in prod (alinea-test) |
|---|---|
| API contracts (openapi.yaml generated from SQL) | 26 schemas, 16 operations — SQL ⇄ YAML ⇄ types: a single thread, anti-drift CI |
| Supabase Auth (session cookie) | Working — admin `REDACTED_EMAIL` (admin role, client arev) |
| Conversation timeline (TKT-105) | **Already built**: ChainDetail composite, chronological mails, extracted content separated, attachments listed |
| Invoices (list + detail + Validate/Reject) | **Already built** — D6 guard: `extracted` target forbidden webapp-side |
| RAG search | Working (embeddings mirror pipeline `gemini-embedding-001` 768d + `rpc_web_doc_search`) |
| R2 signed URLs | Ready — **dependent on `metadata.r2_key`** (pipeline M2.8: OK for the attachments, see §5) |
| Design system | `packages/ui` (tokens, primitives, PageHeader/EmptyState/Skeleton) + skill `alinea-design` |
| Deployment | 1 Cloud Run service `alinea-test`, deploy.sh (surenSaas pattern), Secret Manager secrets `alinea-*` |

## 2. Crossing findings ⇄ tickets (root causes, gaps)

| Ticket | Identified root cause / technical gap | Fix |
|---|---|---|
| **101** crash `/chains` | `participants` = **double-encoded JSON string** by the pipeline (json.dumps passed to the jsonb parameter) → `s.join is not a function` | Webapp: defensive `normalizeParticipants()` (V0). Pipeline: pass the array (mini-prompt §5) |
| **102** FR vocabulary | Technical statuses/labels in the UI | Normative FR mapping centralized in `packages/ui` (labels = display, backend keeps the codes) |
| **103** root page | P0/P1 placeholder + dead button | Redirect `/` → `/login` (unauthenticated) |
| **104** dashboard | Technical runs block | Removed from the manager view; runs kept in "Traitement" [Processing] |
| **105** Gmail thread | "Ouvrir" [Open] on attachments disabled as long as `metadata.r2_key` is missing (pipeline); avatars/quote masking to do | **M2.8 delivered r2_key on the attachments** → verify real presign (V0) |
| **106** summary panel | `classification`/`resume` = NULL (pipeline M3) — chain/linked invoices already contracted | Tolerant UI; pipeline wiring = M3 (non-blocking) |
| **107** conversation chat | Foundation already laid: mirror pipeline embeddings, `rpc_web_doc_search` | **V0**: SQL 009/010 + Gemini 2.5 Flash + isolation C7/honesty C6 |
| **201** invoice queue | SQL CHECK statuses = codes; amounts = number | FR labels + `Intl.NumberFormat fr-FR` + "à traiter" counter UI-side |
| **202** exhaustive detail page | `extraction` jsonb contains the audit (sums, judge); confidence 0.686 explained (0.98 × 0.7 degraded — WEBAPP_DATA_MAPPING §4, revised ×0.85 in M2.8); PDF = `document_id` → presign; back link = `email_message_id` → chain | V2 |
| **203** invoice expert chat | 107 pattern reusable, invoice scope + linked emails | V3 (after 107) |
| **204** Validate/Correct/Reject | Validate/Reject ✓ + `extracted` guard ✓. **"Corriger" [Correct] = contract evolution**: PATCH extended to business fields + jsonb audit (D-B validated) | V2 (TKT-108) |
| **210** actionable search | Result resolution → object: `cap_factures.document_id`/`email_message_id` → detail page; `thread_id` → thread | V3 |

## 3. Ratified architect decisions (2026-09-08)

| # | Decision | Detail |
|---|---|---|
| D-A | **Persistent** chat history in DB | `app_chat_messages` (009) + thread-scoped `rpc_web_doc_search` (010) — applied via targeted runner `--file` |
| D-B | **Value correction** by the webapp | Normal edit mode on the detail page; business fields written + jsonb audit (author/date/old value); `statut` never `extracted` |
| D-C | Chat V1 context = **thread only** | Strict C7 isolation; C6 honesty (no invention) |
| D-LLM | Chat = **Gemini 2.5 Flash** (AI Studio key, same Secret Manager as the embeddings) | The OpenRouter/gpt-4o-mini comparison of the M2.8 report concerns the **extraction pipeline** (D19 pipeline), not the webapp. Embeddings: Gemini frozen D5 — never changed |
| D-Mobile | V1 responsive; PWA (Serwist) then Capacitor later | — |

## 4. Execution waves

| Wave | Content | Tickets covered |
|---|---|---|
| **V0** (this iteration) | Participants fix · SQL 009/010 · complete conversation chat · nav "Emails"=inbox / "Traitement" · PLAN + TKT-108/109 written · deploy | 107 (foundation), 101 (root cause) |
| **V1** | 101 complete stabilization, 105 polish (avatars, quote masking, attachment preview), 106 summary panel, 102 cross-cutting FR vocabulary, 103 root page | 101, 105, 106, 102, 103 |
| **V2** | 201 normative FR queue, 202 exhaustive detail page + provenance, 204/108 actions + value correction | 201, 202, 204, 108 |
| **V3** | 210 actionable search, 104 action dashboard, 203 invoice expert chat | 210, 104, 203 |

## 5. Pipeline dependencies (mini-prompts to hand over to the pipeline session)

1. **`participants` array**: `cap_email_chains.participants` stored as a JSON string — pass the array to `rpc_cap_chain_upsert` (existing rows remain strings; the webapp is defensive).
2. **`r2_key` on the emails** (kind=email): M2.8 delivered it for the attachments — verify that the mail raw (thread.json) is also traced if we want a complete "see the raw email".
3. **classification/summary** (M3): LLM wiring to feed `cap_emails.classification/resume` — will unlock TKT-106 at 100 %.

## 6. Lessons from the webapp session (not to be paid for again)

- `gcloud run deploy --source` mirror-izes the `.gitignore` → explicit `.gcloudignore` mandatory (NEXT_PUBLIC_* build-time)
- GoTrue of this project requires `instance_id = 00000000-…-0000` on users created via direct SQL
- Keys: `VPS_GEMINI_API_KEY` (bashrc, `AQ.Ab8…`) ≠ `SUREN_GEMINI_API_KEY` (hermes.env, invalid) — bashrc VPS_* convention → Secret Manager
- `NEXT_PUBLIC_*`: build-time (`.env.production`) **AND** runtime (`--set-env-vars`)
- Secrets: `sb_secret_` never in git nor the client bundle (verified via greps)
