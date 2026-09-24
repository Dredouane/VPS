# Decision — Capability ged-r2

> Order of rule: **NATIVE > MIX > SIDECAR** (ARCHITECTURE.md §2).

## Need

Archive the **raw files** of every processed email (thread.json +
attachments) to the Cloudflare R2 GED — generic call at the end
of email extraction, **slug as subfolder** to distinguish clients
(requirement 01/09). Reference copy of the raw documents before RAG.

## Options evaluated

| Option | Verdict |
|---|---|
| **Mix**: S3 client SigV4 in stdlib code (hmac/hashlib) to R2 | ✅ **kept** |
| boto3 library | ❌ pip in the container (violates I11) |
| Sidecar MinIO client / dedicated worker | ❌ over-engineering for a PUT/GET |
| Local archiving only (spool) | ❌ the spool is not durable storage |

## Decision

**MIX** — `r2_client.py` implements **AWS SigV4 in stdlib** (hmac/hashlib),
validated against the **official AWS SigV4 test suite vector** (expected
signature bit-for-bit) AND **for real** on the bucket (put 200 → head → get →
delete 204 → head absent). Auth = ACCESS_KEY_ID + SECRET only — the
`VPS_GED_CLOUDFLARE_TOKEN` is a Cloudflare API token (REST), **not** a
S3 session token (R2 rejects x-amz-security-token — verified 01/09).

Deterministic R2 key: `<GED_EMAIL_PREFIX>/<slug>/emails/<thread_id>/<file>`
(the slug distinguishes clients). Idempotent upload (overwrite), `head` for
the audit, `delete` reserved for test cleanup (`_hermes-test/`).

Plan B: boto3 if future S3 complexity (list/versions) — would revisit I11,
to be qualified first.

## Re-check

| Date | Hermes | Verdict unchanged? | Notes |
|---|---|---|---|
| 2026-09-01 | v0.20.6 | — (initial decision) | real OK on bucket suren-saas-ged |
