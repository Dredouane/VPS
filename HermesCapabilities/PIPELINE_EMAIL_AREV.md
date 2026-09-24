# 📧 PIPELINE_EMAIL_AREV.md — Detailed design of the email + invoicing pipeline

> M2 implementation of the AREV agent (`hermes-arev-pro`). Decisions: [`DECISIONS.md`](DECISIONS.md).
> Overall schema: [`README.md`](README.md) · Keys & deployment: [`DEPLOYMENT.md`](DEPLOYMENT.md). This doc fixes the **module
> contracts** and the **non-negotiable rules**.

---

## 1. Overview

| Element | Value |
|---|---|
| Mailbox | `REDACTED_EMAIL` (controlled), filter **recipient contains `+AREV`** |
| Trigger | cron `*/10 8-19 * * *` (silent 8pm-8am), **≤ 5 threads/run** |
| Idempotence | Gmail label `ia-traite` (set at end of pipeline) + `doc_status` by message_id |
| Writes | Generic RPCs `rpc_cap_*` (slug + `CLIENT_RPC_SECRET`, D8-v3) — direct from M2.6 |
| Observability | `pipeline_runs` + `hermes cron incidents` — **no notification** |

## 2. Contracts of the `code/` modules (deterministic, stdlib Python only)

> Rule: each module is a **pure function** (input → JSON output),
> tested by versioned fixtures. `capability-attach.sh` refuses to attach
> if `capability-test.sh` fails. No `pip install` in the container.

### 2.1 `imap_poll.py` — reception (IMAP, D13)

| | |
|---|---|
| Input | env: `VPS_GMAIL_RECEPTION_IMAP_ADRESS`, `VPS_GMAIL_RECEPTION_IMAP_MDP`, `GMAIL_ALIAS_TAG=+AREV`, `GMAIL_LABEL_DONE=ia-traite`, `GMAIL_MAX_THREADS=5`, `GMAIL_SPOOL_DIR`, `GMAIL_NEWER_THAN_DAYS=90` |
| Action | SSL login → **EXAMINE readonly** → `UID SEARCH X-GM-RAW` (`to:<alias> -label:ia-traite newer_than:90d`) → fetch `X-GM-THRID` → group by thread (≤5, recent first) → fetch **BODY.PEEK[]** (never \Seen) → RFC822 parsing (`email.parser`) |
| Spool | `<spool_dir>/threads/<thread_id>/thread.json` + **attachment files** (`att-<n>-<safe-filename>`) — stdout = light summary `{"count", "thread_ids", "spool_dir"}` |
| thread.json output | `{thread_id (X-GM-THRID), messages: [{uid, message_id (canonical Message-ID), header_from/to/subject/date, body_plain (plain preferred otherwise deterministic html strip), attachments: [{filename, mime, size, path}]}]}` |
| Errors | auth → exit 2 ; network/IMAP → exit 3 ; backoff retries |

### 2.1bis `ged_save.py` — R2 archiving (GED, requirement 01/09)

| | |
|---|---|
| When | **immediately after successful polling** (before marking), for EACH thread |
| Action | upload of the spool folder (`thread.json` + attachments) to R2 — key `<GED_EMAIL_PREFIX>/<slug>/emails/<thread_id>/…` (slug = client subfolder) |
| Code | `ged-r2/code/{r2_client,ged_save}.py` (SigV4 stdlib, AWS vector + real, verified) |
| Failure | **non-blocking**: recorded in `pipeline_runs`, the pipeline continues |

### 2.2 `thread_parser.py` — the battle-tested module (D3) + DB SAVE

| | |
|---|---|
| Input | a thread.json from the spool (output 2.1) + optional list of message_ids already in RAG (`rpc_cap_doc_status`, provided by the orchestrator) |
| Processing | role (new/reply/forward — subject Re:/Tr:/Fwd:, headers, quotes), separation of **new content** vs **quoted segments** (FR/EN/Outlook, locked fixtures), chronological position, chain aggregate (normalized subject, participants, date bounds) |
| Output | `{"thread_id", "chain": {subject, participants, messages_count, first/last_message_at}, "mails": [{message_id, uid, role, position, new_content, quoted_segments[], attachments, rag_status: known\|new}], "stats"}` |
| Guarantee | idempotent (re-parse = same result), multilingual fixtures; **`Tr:` = FR forward**, `Re:` = reply |

**Deterministic ORCHESTRATOR (D15-bis)**: `email-processing/code/run_pipeline.py`
chains everything in §2 (poll → parse+save → GED → OCR → judge → branch →
embed → upsert → mark_done → log) — idempotent, `--max-threads`, `--dry-run`,
`--force-attachments` (recovery). The cron routine calls it directly.
Choose a single extractor if the other fails (degraded, `low_agreement`).

**DB SAVE (requirement 01/09 — by the orchestrator after the parser, via supabase MCP C5)** — **generic** RPCs with `p_client_slug` + `p_rpc_secret` (env `CLIENT_SLUG`/`CLIENT_RPC_SECRET`, D8-v3):
1. `rpc_cap_chain_upsert(slug, secret, thread_id, subject, participants, count, first, last)` → 1× (chain, idempotent)
2. `rpc_cap_email_upsert(slug, secret, message_id, thread_id, role, from, subject, date, classification, resume, status='received')` → **per email** (full chain, including lazy old emails)
3. `rpc_cap_doc_status(slug, secret, message_ids)` before indexing → only re-index `new`

### 2.3 `doc-ocr` — OCR multi-provider + two judges (D14)

| | |
|---|---|
| Extractors | `ocr_gemini.py` (Gemini Vision) + `ocr_openrouter.py` (OpenRouter vision, different family) — **in parallel**, generic output `{text, doc_type_hint, confidence}` |
| General judge | pure code, always: token-overlap similarity, completeness, confidence ×2 → winner; strong disagreement → `low_agreement` + reduced confidence |
| Invoice branch | majority hints + code heuristics → SLM Flash adapter (generic → canonical JSON `schemas/invoice_extraction.json`) → code validation → AMOUNT CHECK: Σ lines == HT, HT+VAT == TTC (±0,02) |
| Output | `{text, structured?, confidence, extractor, judge: {scores, sums_ok, detail}}` → C4 (embeddings) + C6 (pre-verified invoice) |

### 2.4 `embed_gemini.py` — embeddings (D5)

| | |
|---|---|
| Input | texts to index + `VPS_GEMINI_API_KEY` |
| Output | `{ "embedding": [768 floats], "model": "text-embedding-004" }` — **frozen** dimension |

### 2.5 `imap_mark_done.py` — idempotence

Move to the `ia-traite` label (created if absent): `UID COPY` →
`\Deleted` → **targeted UID EXPUNGE** (never a global expunge). Skip if already
labeled (X-GM-LABELS). Called ONLY at the end of a successful pipeline —
in case of error, the message stays in place and will be reprocessed on the
next tick.

### 2.6bis Chain of Experts — capability `analysis-facturation` (M2.5)

| | |
|---|---|
| `expert-router` | decides which experts are involved (strict JSON `{experts, confidence, reason}`) — invoicing if `doc_type == facture` OR invoicing classification + attachment/keywords |
| `expert-facturation` | matching (`rpc_cap_facture_find`) + upsert (`rpc_cap_facture_upsert`, status `extracted`, D6) — numbers **already verified** by the C3 amount check; numero absent = no upsert (pipeline_runs) |
| Output | structured invoice in `cap_factures` → webApp CRUD + other agents |

**Keys & full deployment**: [`DEPLOYMENT.md`](DEPLOYMENT.md).

## 3. LLM Skills (Hermes)

| Skill | Role | Imposed output |
|---|---|---|
| `email-classify` | business category (invoicing / quote / construction-site / admin / other) + 1-sentence summary | strict JSON `{categorie, resume, flags}` |
| `expert-router` | Chain of Experts: "does this email concern me?" | strict JSON `{"experts": ["facturation"], "confidence", "reason"}` — empty if none |
| `expert-facturation` | extracts **all invoicing context** from the email + OCR of the attachment, matches and upserts | strict JSON of the invoice model (§5) |

The skills **read the SQL definitions** (copied into `data/sql/arev/`) to
know the available tables/RPCs — the schema is the source of truth (D9).

## 4. Idempotence & errors

1. A message is **never indexed twice**: `doc_status` before indexing
   (and dedup by content: unique `(client_id, kind, content_md5)` in the DB —
   an already-seen attachment creates no duplicate).
2. The `ia-traite` label is set **only after full success** of the email (RAG ±
   expert). Error → no label → reprocessed next tick (natural retry).
3. After **3 failures** of the same message (counted in `emails.status='error'`),
   it is left unlabeled and reported in `pipeline_runs.last_error` —
   manual investigation (no infinite poison-queue).
4. Each run inserts a `pipeline_runs` row (counters: threads_seen,
   mails_new, mails_known, attachments_ocr, docs_indexed, factures_upserted,
   errors, duration_ms).

## 5. Data model (summary — source of truth: `sql/`, single multi-tenant project)

**Generic tables** `public.cap_*` with a `client_slug` column (the slug drives
everything — D7-v2/D9-v2):

- `cap_documents` — RAG: `embedding vector(768)`, `kind`
  (`email`|`attachment`), `message_id`, `thread_id`, `thread_role`,
  `metadata jsonb` (**vector tags**: `from`, `date`, `filename`, `mime`,
  `classification`, `ocr_confidence`, `pipeline_version`). Dedup:
  unique `(client_slug, kind, content_md5)`.
- `cap_emails` — processing state per message (classification, summary,
  status, attempts, error).
- `cap_factures` — expert extraction: `numero`, `fournisseur`,
  `montant_ht/tva/ttc`, `date_facture/echeance`, `statut`
  (`extracted`→`valide`/`rejete`/`paye`), `confiance`, link `email_message_id`
  + `document_id`, `extraction jsonb` (raw audit). Matching:
  unique `(client_slug, numero, fournisseur)`.
- `cap_pipeline_runs` — observability (1 row/run).
- `cap_clients` — **client registry** (D7-ter): slug, name, status, referent,
  rpc_prefix — declared by the runner, FK source for all tables
  (`client_slug → slug`). Managed by the runner only.
- `cap_migrations` — runner tracker (supabase-sql.sh).

**Generic RPCs** (`sql/generic/006_rpc_generic.sql`, security definer,
slug + secret per client — D8-v3): `rpc_cap_doc_status`, `rpc_cap_doc_upsert`
(positional order: slug, secret, kind, message_id, content, embedding, then
optionals), `rpc_cap_doc_search` (bound ≤20), `rpc_cap_email_upsert`,
`rpc_cap_chain_upsert/get`, `rpc_cap_facture_find/upsert` (no downgrade of
validated invoices), `rpc_cap_pipeline_log`.
The skills read the definitions copied into `data/sql/` (D9).

## 6. Non-regression (locks)

1. Contract tests inherited from the TEMPLATE + capability-specific tests
   (`capability-test.sh all` → 0 FAIL mandatory).
2. **Frozen fixtures** for `thread_parser`: any behavior change goes through
   an explicit fixture update (visible diff in review).
3. `capability-attach.sh` runs the tests before any apply — refuses on FAIL.
4. RPCs versioned in git; migrations are append-only numbered files
   (`sql/arev/00N_*.sql`).

## 7. M2 sequencing

| Step | Deliverable | Prerequisites |
|---|---|---|
| M2.0 | `sql/arev/` applied on the **TEST** project (pgvector, RPC, RLS) | TEST Supabase access |
| M2.1 | C1 `email-gmail`: poller + labeling + OAuth helper | AREV refresh token |
| M2.2 | C2 `email-processing`: thread_parser + fixtures + classify | — |
| M2.3 | C3 `doc-ocr` + C4 `rag-embeddings` (code + fixtures) | Gemini key |
| M2.4 | C5 `rag-supabase` finalized (RPCs tested on TEST) | M2.0 |
| M2.5 | C6 `analysis-facturation` (router + expert + invoice RPC) | M2.2-M2.4 |
| M2.6 | spawn v2.1 (env pass-through) + rsync + `capability-attach.sh arev …` + end-to-end validation (real 3-email thread + fake scanned invoice → invoice `extracted` visible in webapp) | all |
