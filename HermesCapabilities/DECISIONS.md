# 📜 DECISIONS.md — HermesCapabilities decision register

> ADR style (like `HermesConfig/ARCHITECTURE.md`). Decisions made during the
> grill-me sessions of 30-31/08/2026 for the AREV email pipeline. Each
> decision states the **rejected** alternative and the rationale. Do not
> reopen without a new documented lesson.

---

## Summary table

| # | Decision | Rejected alternative |
|---|---|---|
| D1 | Trigger = **cron polling** 10 min, off-peak hours 8pm→8am | Gmail Push Pub/Sub · external Cloudflare webhook |
| D2 | **Expert = skill** in the same agent (Chain of Experts) | Real Hermes bot from M2 · dedicated sidecar agent |
| D3 | Thread-parser = **deterministic, battle-tested code** (no LLM) | LLM parsing of quotes |
| D4 | OCR = **Gemini Vision** (reused SUREN key) | Local Tesseract · Firecrawl API |
| D5 | Embeddings = **Gemini gemini-embedding-001, 768d, frozen** | OpenAI 1536d · local embeddings |
| D6 | Invoicing: **auto-upsert + `extracted` status** | Propose-then-write · confidence threshold |
| D7 | **ONE multi-tenant Supabase project** (clients, tests, prod) — generic `cap_*` tables + `client_slug` column, the slug drives everything | Separate TEST project · schema per slug (obsolete) |
| D8 | DB access = **generic RPCs** `rpc_cap_*` (slug + **`CLIENT_RPC_SECRET`** per client verified in `cap_clients`) on generic tables; RLS deny-all; publishable key | Direct service key · direct table access · hardcoded per-slug RPCs (v2, removed 01/09) |
| D9 | **`sql/generic/` + `sql/<slug>/`** = source of truth; runner `supabase-sql.sh` + tracker `cap_migrations` | Scattered SQL · all-slug scripts |
| D10 | **Strict +AREV filter** — multi-client mailbox by alias | Process the whole mailbox |
| D11 | **Silent** — zero Telegram, traceability via `pipeline_runs` | TG notifications per processed email |
| D12 | **Direct rollout** + 10 min cadence / max 5 threads | DRY_RUN phase · 30 min / 20 threads |
| D13 | Reception = **IMAP app password** (existing creds, OAuth Testing = refresh expires after 7d, deterministic RFC822 parsing) | Gmail OAuth API (revised 01/09) |
| D14 | OCR = **2 vision extractors** (Gemini + OpenRouter) + **two separate judges**: general (code, always) / amounts (invoice branch, code) with SLM Flash adapter | Single merged judge (review 01/09) · single extractor · schema imposed on all docs |
| D15 | **Invoice = attachment-sourced only** — the structured data comes exclusively from an OCR-verified invoice attachment; an nth forward without attachment = RAG + chain only, never overwritten. "Processed or not" identification by email (message_id, 3 levels: label, doc_status, facture_find) | Creating/updating invoices from the text of a thread email |
| D15-bis | **Deterministic orchestrator** `run_pipeline.py` = backbone of the pipeline; LLM skills grafted via the routine prompt | Fragile LLM-orchestrated chain |
| D16 | Degraded confidence: **extractor unavailable → ×0,85** vs two diverging extractors → ×0,7 (distinguish "absent" from "disagreement") | Uniform ×0,7 (too pessimistic) |
| D17 | **Forward = ignored envelope** — processing starts at the next email (skip cover + header block); `from` = real sender; invoice = attachment-sourced (D15) | Index the forward envelope text |
| D18 | **Vendoring** of `mail-parser-reply` v1.36 (MIT, fr/en/de/it/nl/da/ja) — robust multi-provider replies/quotes separation without pip at runtime | Homegrown regex parser · SLM parse · pip at runtime (I11) |
| D19 | **CR/LF normalization at the source** (imap_poll.py) — the raw Gmail body `\r\n` → `\n` before body_plain, the vendor lib receives clean text | Bolt-on at parser/thread level |
| D20 | **clean_body.py** — email body cleaning for webApp display + RAG (images, cid, quotes-fold, signatures dedup, markdown strip) | Inline bolt-on · cleaning on the webApp side |
| D21 | **Multi-type extraction** (doc_extract.py) — xlsx/docx/pptx/csv/txt via native libs + irrelevant-image filter (OCR < 50 chars → skip) + r2_key per basename + invoice linked to the document via document_id | PDFs/images only · r2_key by global counter · no invoice→document link |
| D22 | **Split of forwards** into individual messages via mail-parser-reply — from/date/subject extraction from Outlook/FR headers | Forward = monolithic block |
| D23 | **Merging of multiple chains** (forward on the same subject) | Separate chains per forward |
| D24 | **`GMAIL_ALIAS_TAG` required** — no `+AREV` default, check in `spawn-hermes-pro.sh` | Hardcoded default → cross-pollination |
| D11-ter | Headless: routines on the **default profile** (the scheduler only consumes it) — ops profile = Desktop only | Routines on secondary headless profiles (they don't fire) |

---

## D1 — Trigger: cron polling with off-peak hours ✅

**Decision**: Hermes cron routine `*/10 8-19 * * *` (no tick between 8pm and
8am), max **5 threads per run** (an email spike spreads out, never a timeout).

**Rejected**:
- *Gmail Push Pub/Sub*: ~seconds latency but a GCP project to create + watch to
  renew every 7 days + dependency on external infra — not justified for an
  SME (an invoice doesn't arrive 10 minutes before its due date).
- *External webhook (Cloudflare Email Routing → `hermes webhook`)*: requires
  enabling the HTTP API gateway in the container (today headless,
  checked: nothing listens on 8642) + raw email parsing on the CF side — complexity
  for a useless latency gain. Re-evaluable if realtime is needed (D1 bis).

**Verification note (31/08)**: no native Hermes email support (gateway/tools
empty); `hermes webhook` exists but unusable in the current headless setup.

## D2 — Expert = skill in the same agent ✅

**Decision**: the **Chain of Experts** pattern is implemented in M2 by a
**router** skill ("does this email concern me, which experts?") + **expert** skills
(e.g. `expert-facturation`), executed by the same agent.
Each expert is a **deep module**: its scope, its RPCs and its
soul-addendum are encapsulated in its capability.

**Rejected**:
- *Real Hermes bot (isolated profile) from M2*: headless multi-bot
  orchestration (kanban/peer) is not yet validated on our side; costly to
  debug. Natural evolution in M3 once the pattern is proven.
- *Dedicated sidecar agent*: ×2 floating cost for one expert — overkill.

## D3 — Thread-parser: deterministic, battle-tested code ✅

**Decision**: understanding the mailChain is a **deterministic code
module** (`thread_parser.py`), NOT an LLM prompt. Input: the full thread
(Gmail JSON). Output: **structured list of all emails in the thread** with
RAG status (already indexed / new) — which **solves emails from before the
service existed** (lazy backfill on each received email of the thread, cf.
D11 bis).

**Why**: parsing quotes (`Le … a écrit :`, `On … wrote:`,
`De :`, forward separators) is a parsing problem, not a comprehension
problem — an LLM is non-deterministic and untestable there. The code is
**idempotent, testable via multilingual fixtures, non-regressive**.

**Non-negotiable**: this module and its fixtures are locked — any change
goes through the tests; `capability-attach.sh` refuses to attach
a capability whose tests fail.

## D4 — OCR: Gemini Vision ✅

**Decision**: OCR of attachments via **Gemini Vision** (`SUREN_VPS_GEMINI_API_KEY`,
reused — quota monitored, dedicated AREV key if friction). High quality on
scanned invoices and construction-site photos.

**Rejected**: *local Tesseract* (free/private but insufficient quality on
tilted photos); *Firecrawl* (key to create, pricing to qualify).

**Note**: documents transit through Google — the mailbox belongs to
Redouane (data controller), acceptable; client consent to be formalized if
the mailbox becomes the client's.

## D5 — Embeddings: Gemini text-embedding-004, 768d ✅

**Decision**: **frozen** model `text-embedding-004` (768 dimensions). Changing
models = reindex the whole RAG → the SQL schema (`vector(768)`) and the code
are locked on it. Same SUREN key as the OCR (vendor consistency).

**Rejected**: *OpenAI* (key to create, 1536d); *local Ollama* (one more
brick to maintain on the VPS).

## D6 — Invoicing: auto-upsert + `extracted` status ✅

**Decision**: the expert writes **automatically** to Supabase with
`statut='extracted'` + raw extraction payload (`extraction jsonb`) and
confidence. **Human validation = status transition** in the webapp
CRUD (`valide` / `rejete`). Data extraction is not a binding act
(unlike sending a document) — the main SOUL.md is not violated.

**Rejected**: *propose-then-write* (pipeline blocked without a human); *hybrid
confidence threshold* (threshold uncalibrated at first — re-evaluable after feedback).

## D7 — Supabase: ONE multi-tenant project, the slug drives everything ✅ (revised 31/08, D7-ter 01/09)

**Decision (revision following user decision)**: a **single Supabase
project** hosts the whole Hermes project — all clients, tests AND prod. The
**instance slug discriminates everything**: generic `public.cap_*` tables
with a `client_slug` column, and the slug drives all SQL/RAG queries via the
**generic RPCs + secret per slug**. The client's CRUD webapp will consume
these tables (same project, zero synchronization).

**D7-ter (01/09) — Registry + integrity**: generic table
`public.cap_clients` (slug, name, `active/suspended/archived` status, referent,
rpc_prefix), **FK** `client_slug → cap_clients.slug` on the 4 data
tables, **auto-declaration by the runner** when applying a `sql/<slug>/`
folder (`--client-nom` / `--client-referent`). The registry is managed
**by the runner only** (RLS deny-all, no RPC for the agent). An unknown slug
can no longer create data.

**Deferred decisions (review 01/09)**: the **AREV CRUD webapp will be built
later** — its readers (REST/RLS/API) will be documented at design time;
**retention/purge** is deferred (tiny volumes at first, reversible decision).

**Rejected / obsolete**: *separate TEST project* (initial D7 version — replaced
by admin-side smoke tests on the same project, marked rows + cleanup);
*schema per client (`cap_<slug>`)* (v1 — replaced by the `client_slug` column);
*purely git registry without SQL* (ghosts possible).

## D8 — Generic RPCs + secret per slug, RLS deny-all ✅ (v3, 01/09)

**Decision (v3 — revision following user review)**: hardcoded per-slug RPCs
(`rpc_cap_arev_*`, v2) created a ×N duplication across clients (the
agent/webapp would have had to target different function names per slug).
**V3**: **a single series of generic RPCs** `rpc_cap_*` with a common
signature `(p_client_slug, p_rpc_secret, …)` — the `cap_auth_client` guard
validates the pair against `cap_clients` (status='active') and returns the slug.
The secret (`CLIENT_RPC_SECRET`, 24 hex bytes) is **generated by the runner** at
declaration time and written to `client.env` (600). The generic tables remain
RLS deny-all + grants revoked: the publishable key alone no longer suffices — the
slug secret is also required.

**Cleanup**: the 9 per-slug RPCs are **dropped** (clean swap —
`arev/003_rpc_deprecate.sql`, nothing in prod). The webApp will use **the same
generic tables** (service key) without jumping between functions per slug.

**D8-bis evolution (future)**: per-client JWT (slug claim + RLS) if fine-grained
rotation/expiry is needed. Residual risk: secret per slug in
`client.env` (600, outside git) — same exposure as the client's other secrets.

## D8-v2 (historical — replaced by v3)

## D9 — generic + dedicated sql/, runner with tracker ✅ (revised 31/08)

**Decision (revision)**: `sql/generic/` = common structure **without slug**
(tables, indexes, RLS); `sql/<slug>/` = **slug-dedicated** scripts (RPC +
specifics) — separation requested by the user. The runner
`scripts/supabase-sql.sh` applies **generic first, slug second**,
tracks each file in `public.cap_migrations` (never double-apply,
`--force` to reapply idempotent DDL), built-in post-checks (tables,
RLS, RPC), smoke tests + admin cleanup.

## D7bis/D9bis (historical v1 — replaced above)

## D10 — Strict +AREV filter ✅

**Decision**: `REDACTED_EMAIL` is a **controlled mailbox** intended for
multi-client via Gmail aliases (`+AREV`, `+CLIENT2`…). The AREV agent only processes
messages whose recipients contain `+AREV`. Each client will have: its OAuth (dedicated
refresh token), its +TAG filter, its generic RPCs sealed by client secret.

## D11 — Silent: zero Telegram ✅

**Decision**: no Telegram notification from the pipeline (neither success, nor
invoice). Traceability = `pipeline_runs` table (counters, errors per run) +
`hermes cron incidents`. Consultation via webapp/Supabase.

**Rejected**: notifications per processed email (noise) — can be reintroduced
later for anomalies only.

## D12 — Direct rollout + cadence ✅

**Decision**: no DRY_RUN phase — real writes from day one (the RPCs are
validated beforehand on the TEST project + fixtures).
Cadence: poll every 10 min (8am-8pm), **max 5 threads per run**.

**Rejected**: DRY_RUN first (delays go-live); 30 min/20 threads
(big batches = long runs, timeout risk).

---

## D13 — Email reception: IMAP app password ✅ (01/09, revised after initial M2.1)

**Decision**: reception goes through **IMAP app password** (creds already
owned by the owner of the mailbox) rather than the Gmail OAuth API. Checked
**live in read-only (01/09)**: login OK, X-GM-RAW (Gmail search),
X-GM-THRID (threading), X-GM-LABELS, label `ia-traite` to create.

**Why IMAP**:
1. Creds **already in place** (`VPS_GMAIL_RECEPTION_IMAP_ADRESS/MDP`) — zero Google Cloud setup.
2. ⚠️ OAuth: an app in unverified *Testing* mode → **refresh token expires
   every 7 days** (Google policy) — untenable in prod without app verification.
3. **More deterministic** parsing: raw RFC822 → stdlib `email.parser`.
4. `imaplib` + `email` = stdlib (invariant I11).

**Guarantees**: read EXAMINE + BODY.PEEK (zero mutation); marking =
COPY to `[Gmail]/ia-traite` + \Deleted + **targeted UID EXPUNGE** (never
a global expunge); skip if already labeled. **Plan B**: OAuth API (helper
`gmail-oauth-setup.sh` kept) — to re-evaluate once app verification is done.

## D14 — OCR multi-provider, two separate judges ✅ (01/09)

**Decision (revised after user review)**: the OCR module extracts documents of
ALL kinds — the extractors' output is **generic**
(`{text, doc_type_hint, confidence}`), not an invoice schema imposed on all.

**Two separate judges** (the initial merge was a design mistake):
1. **General judge** (always, pure code): token-overlap similarity between the
   2 extractions, completeness, confidence, doc_type = **majority of hints +
   heuristics** (invoice/VAT/due-date words + amount density), winner;
   strong disagreement → `low_agreement` + reduced confidence.
2. **Amount check** (branch **only if invoice**): SLM adapter
   **Gemini Flash** reformats the winning text into canonical JSON
   (`schemas/invoice_extraction.json`), output **re-validated by code**
   (aliases, FR/EN numbers), then Σ lines == HT and HT+VAT == TTC (±0,02).
   Invalid reformat = `sums_ok: null` — never invented. A non-invoice
   document has NO amount check.

Extractor #2: **OpenRouter vision** (existing `SUREN_VPS_OPEN_ROUTER_API_KEY`)
— different family from Gemini = true diversity. Rejected: single merged
judge, schema imposed on all docs, Tesseract sidecar.

## D15 — Invoicing: attachment-sourced + identification by email ✅ (real run 01/09)

**Decision (user requirement)**: all emails to the alias will be
**forwards**; old emails may have already handled invoicing. The "already
processed or not" mechanism = **identification by email** (message_id),
already in place at **3 levels**: (1) poller `-label:ia-traite`, (2)
`rag_status` by message_id (`rpc_cap_doc_status`), (3) invoice via
`rpc_cap_facture_find(numero, fournisseur)` + no downgrade (D6).

*New*: the structured invoice comes **only** from an invoice attachment
(pre-verified canonical OCR). Without attachment → RAG + chain, never
overwritten. Existing: an even $VPS_EXÉCUT… *n/a*.

*Model drift 01/09*: vision moved from `gemini-2.0-flash` to
**`gemini-3.6-flash`** (2.0 removed from the API — 404), embeddings
`text-embedding-004` → **`gemini-embedding-001`** (768d via
outputDimensionality). Lesson: **check model availability at every key
deployment**.

## D18 — Vendoring mail-parser-reply ✅ (research 01/09)

**Decision**: the replies/quotes separation (fragile between Gmail FR/Outlook
FR/EN/mobile clients) is delegated to the **mail-parser-reply** v1.36 lib
(MIT, multilingual **fr included** by default + en/de/it/nl/da/ja, maintained,
pure Python), **vendored** into
`capabilities/email-processing/code/vendor/mailparser_reply/` — license
kept, pinned version, update = re-vendoring.
**No pip at runtime** (I11) nor Dockerfile (vendoring is versioned code).

**Why not the Gmail IDs**: `X-GM-THRID` groups messages in OUR
mailbox — a forward's internal thread exists only as text in the body →
text parsing remains indispensable for the "gmail-like" webApp display.
Plan B (M3): `parse_degraded` flag → SLM if the lib fails on an exotic
provider (idea kept).

**Known limitation**: RAG dedup of attachments is on OCR content
(md5 of the text) — two force-attachments runs can create duplicate docs
if the OCR varies slightly (file-md5 dedup fix planned M3; the normal
mails_new path creates no duplicates).

## D19 — CR/LF normalization at the source ✅ (01/09, after OpenRouter PDF research)

**Fix**: the `\r\n` → `\n` normalization happens in `imap_poll.py` at the
**source of `body_plain`** (the first place the content is extracted from
the rfc2822). The thread_parser and the vendored lib receive clean text.
No bolt-on in `split_quoted`.

## OpenRouter PDF: `file` content type (research 01/09)

**Architectural revision**: the `image_url` data-Type is NOT the right format
for sending PDFs via OpenRouter. The right one = **`file`** content type
(`plugins: [{"id": "file-parser", "pdf": {"engine": "cloudflare-ai"}}]` —
free), with 3 engines (cloudflare-ai free, mistral-ocr $2/1k page),
works with any model. **With PDFs OpenRouter becomes the strong path** that
works for any vision LLM (no restriction to the native model).

**Model chosen**: `openai/gpt-4o-mini` ($0.15/$0.60 per million) — the
cloudflare-ai engine parses PDFs for free and feeds them to GPT-4o-mini as input. The
native image vision of GPT-4o-mini handles image attachments.

## D20 — clean_body.py: email body cleaning for webApp display + RAG ✅ (after TKT-109-b)

**Decision**: a **pure deterministic** module `clean_body.py` in
`email-processing/code/` cleans the new content of each email
**after** `split_quoted` (vendored lib D18) and **BEFORE** embed + doc_upsert:

1. **R1**: `[image:…]`, `[cid:…]`, `<img>` → removed (HTML→plaintext artifacts)
2. **R2**: replicated reply/forward headers → `[citation masquée]` /
   `[transfert masqué]` (one compact line)
3. **R3**: duplicated signatures (phone, address, "Cordialement") → deduped
   (the forward chain contains N copies of the same signature)
4. **R4**: main content, lists, simple tables **kept**
5. **R5**: residual markdown (bold `**`, `##`) → removed

Output: plain text (no HTML or markdown), stored in
`cap_documents.content` → the webApp displays the clean text **directly**.
The RAG is cleaner (content is the useful text, not repeated
re-capitalizations).

## D21 — Multi-type document extraction + r2_key fix + invoice→document link ✅ (10/09)

**Problems**:
1. **r2_key bug**: the `entry['attachments_ocr']` counter is global but the spool names files by per-message counter → silent fallback to `thread.json` → the webapp downloads a JSON instead of the PDF.
2. **Blocked types**: the hard `.pdf/.png/.jpg/.jpeg/.webp` filter ignores xlsx/docx/pptx/csv.
3. **No invoice→document link**: `rpc_cap_facture_upsert` accepts `p_document_id` but the pipeline didn't pass it.
4. **Irrelevant images**: signatures, logos, artifacts indexed uselessly in the RAG.

**Decisions**:
1. **r2_key per basename**: lookup `r2_map.get(os.path.basename(path))` instead of the counter → each attachment has its own R2 key.
2. **`doc_extract.py`**: deterministic module (openpyxl, python-docx, python-pptx) to extract text from Office files. PDFs/images remain handled by the vision OCRs.
3. **Pipeline reordering**: doc_upsert **BEFORE** invoice branch → capture of the `doc_id` returned by the RPC → pass it to `p_document_id`.
4. **Irrelevant-image filter**: if the OCR text is < 50 chars → skip embed + upsert (signature, logo, artifact). `attachments_skipped` counter in the logs.
5. **Unknown types**: log error into `cap_pipeline_runs.last_error` + increment `errors`, no crash.
6. **`requirements.txt`**: openpyxl, python-docx, python-pptx — installed at spinoff for all fleet instances.
7. **Migration 008**: backfill `document_id` on existing invoices + fix the `r2_key` of attachments pointing to `thread.json`.

## D22 — Split of forwards into individual messages (10/09)

**Problem**: a forward to the `+AREV` alias contains 1 single IMAP message
(in the spool), but the forward body contains the full chain (N
historical messages). Result: `messages_count = 1`, `quoted_segments = []`,
the webapp shows "1 message" while the chain has 5. The RAG indexes the whole
forward as a single monolithic document.

**Decision**: feed the forward content back into `mail-parser-reply` (vendored
D18) to extract the individual messages of the chain. The lib already
recognizes separators from 14 languages (Gmail, Outlook, Apple Mail).

**Implementation details**:
1. **`thread_parser.split_quoted()`**: when a `RE_FORWARD_HEADER_BLOCK` is
   detected, extract the forwarded body then feed it back into `EmailReplyParser.read()`.
   Each `EmailReply` fragment = one message of the chain. `replies[0]` =
   most recent message (new content), `replies[1..N]` = historical messages
   (quoted segments).
2. **`thread_parser.parse_mail()`**: for each fragment, extract `from`,
   `date`, `subject` from the fragment's `headers` field (contains the
   `De:`, `Envoyé:`, `Objet:` lines or `On ... wrote:`).
3. **`run_pipeline._process_thread()`**: create N `cap_emails` + N
   `cap_documents` per thread (one per message), instead of a single one.
4. **`cap_email_chains.messages_count`** = real number of messages in the
   chain (not 1).
5. **`cap_email_chains.participants`** = real senders of the chain
   (extracted from the headers of historical messages).
6. **Fallback**: if the split fails (body without recognized separator), log a
   warning and keep the raw content as `new_content` (no data loss).

**Non-scope** (D23): merging several forwards on the same subject into a
single chain.

**Tests**:
- CR RC 07/04: 3 messages in the chain → 3 `cap_emails`, 3 `cap_documents`
- Forward without separator → fallback, 1 `cap_email`, raw content
- Classic Gmail forward (`On ... wrote:`) → correct split
- Outlook forward (`De: / Envoyé:`) → correct split
- 48 existing tests → 0 regression

## D24 — GMAIL_ALIAS_TAG required, no default (10/09)

**Problem**: `imap_poll.py` and `run_pipeline.py` had a hardcoded
`+AREV` default for `GMAIL_ALIAS_TAG`. Result: all clients without an
explicit alias poll the same `+AREV` inbox → cross-pollination (data
mixed up in Supabase).

**Decision**: `GMAIL_ALIAS_TAG` is **required** — no default. If absent,
the pipeline fails explicitly (`RuntimeError`). Each client must
define its alias in `client.env` (e.g. `+AREV`, `+FATEH`).

**Fix**:
1. `imap_poll.py:155`: `cfg["GMAIL_ALIAS_TAG"]` (KeyError if absent)
2. `run_pipeline.py:246`: `env["GMAIL_ALIAS_TAG"]` + explicit check
3. `manifest.yaml`: "required per client" comment, no value
4. `spawn-hermes-pro.sh`: validation at creation of the secrets.env

**Prevention**: `spawn-hermes-pro.sh` fails if `GMAIL_ALIAS_TAG` is missing
from `client.env`.

## D23 — Merging multiple chains (forward on same subject) (10/09)

**Problem**: when a client receives a reply in their mailbox and forwards it
to `+AREV`, Gmail creates a **new `thread_id`** in the +AREV inbox (it is
a new IMAP message). Result: 2 separate chains in the DB for the same
subject, with no link between them.

**Example**:
```
Chain 1: thread_id=1863095346079811737 | CR RC 07/04 | 1 email
Chain 2: thread_id=999888777666555444   | Re: CR RC 07/04 | 1 email
```

**Decision**: add a chain detection and merging mechanism based on the
normalized subject, with chronological order preservation.

**Identified risks and mitigations**:

| Risk | Impact | Mitigation |
|---|---|---|
| **False positive**: 2 different subjects normalizing identically (e.g. "CR RC" in 2 projects) | Erroneous merge of 2 distinct chains | Merge key = `(subject_normalized, client_slug)` — 2 chains only merge if they have the same subject AND the same client. Add a similarity threshold (Levenshtein ≤ 2) for near-identical subjects. |
| **Chronological order**: dates of historical messages may be mixed up | Messy display in the webapp | Sort the `cap_emails` by `date_iso` chronologically after merge, not by arrival order. |
| **Duplicates**: the same message can appear in 2 forwards (the client forwards the same email twice) | Duplicate documents and embeddings | Dedup by `content_md5` (already exists) + dedup by `message_id` if present in the headers. |
| **Participants**: participants of the 2 forwards may overlap | Duplicated participant list | Dedup `participants` after merge (set union). |
| **Invoices**: an invoice can be in the 1st or 2nd forward | Double invoice extraction | `facture_upsert` is idempotent by `content_md5` — no duplicate. Check that `p_email_message_id` points to the right message. |
| **R2**: attachments of the 2nd forward have different R2 keys | No collision (keys based on basename) | No risk — each forward has its own keys. |
| **Migration**: existing chains in the DB are not merged | No immediate regression | The merge only applies to new forwards. No migration needed (or optional backfill). |
| **Idempotence**: re-forwarding the same email must not create a duplicate | Chain merged in duplicate | The pipeline is already idempotent (content_md5). The merge checks whether the target `thread_id` already exists before merging. |

**Detection algorithm**:
1. When a new thread is processed, extract `subject_normalized` (without
   Re:/Fwd:/Tr:).
2. Search in `cap_email_chains` for an existing thread with the same
   `subject_normalized` AND the same `client_slug`.
3. If found: merge the `cap_emails` of the new thread into the existing
   thread, sort by `date_iso`, update `messages_count` and
   `participants`.
4. If not found: create a new chain (current behavior).
5. If several matches: merge with none (ambiguity) + log
   a warning.

**Merge algorithm**:
1. `cap_emails` of the source thread → `UPDATE thread_id = thread_cible` (if
   `message_id` not already present in the target thread).
2. `cap_documents` linked to transferred emails → `UPDATE thread_id = thread_cible`.
3. Recompute `messages_count`, `participants`, `first_message_at`,
   `last_message_at` on the target thread.
4. Delete the source thread (emptied) if it has no linked email left.

**Non-scope**: automatic detection of chains outside the +AREV inbox (e.g.
chains in the client's personal mailbox).

## History

- 2026-08-31: creation of the register (D1-D12, grill-me session pipeline
  email AREV). Design doc: [`PIPELINE_EMAIL_AREV.md`](PIPELINE_EMAIL_AREV.md).
