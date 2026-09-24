# Capability ged-r2 — R2 archiving of raw emails

**Type**: `mix` · **Status**: M2.2-ter — SigV4 stdlib validated (AWS vector +
real), slug-scoped save operational

Generic save of raw email files (thread.json + attachments) to
**Cloudflare R2** (S3-compatible, **stdlib** SigV4 — no pip), called at
the end of email extraction. R2 key:
`<GED_EMAIL_PREFIX>/<slug>/emails/<thread_id>/<file>`
— the slug distinguishes clients (requirement 01/09).

## Components

| File | Role |
|---|---|
| [manifest.yaml](manifest.yaml) | Contract: R2 secrets, code [r2_client, ged_save] |
| [decision.md](decision.md) | Mix SigV4 stdlib — API token ≠ S3 session token (verified) |
| [code/r2_client.py](code/r2_client.py) | SigV4 (AWS test suite vector ✓) + put/get/head/delete |
| [code/ged_save.py](code/ged_save.py) | Save of a thread folder → R2 (slug-scoped) |
| [soul-addendum.md](soul-addendum.md) | Refusals: other slugs, content outside the spool, R2 ≠ primary source |
| [tests/test.sh](tests/test.sh) | SigV4 AWS vector + real put/get/head/delete integration |

## Required secrets (in `HermesConfig/clients/<slug>/client.env`, 600)

| Variable | Role |
|---|---|
| `VPS_GED_CLOUDFLARE_S3_EU_ENDPOINT` | R2 endpoint (eu.r2.cloudflarestorage.com) |
| `VPS_GED_CLOUDFLARE_BUCKET_NAME` | GED bucket |
| `VPS_GED_CLOUDFLARE_ACCESS_KEY_ID` | R2 access key |
| `VPS_GED_CLOUDFLARE_SECRET_ACCESS_KEY` | R2 secret |
| `VPS_GED_CLOUDFLARE_TOKEN` | Cloudflare API token (REST) — **not used by S3** |

Env: `CLIENT_SLUG` (already in client.env), `GED_EMAIL_PREFIX=emails`.

## Costs / quotas

R2: class A/B storage per operations — polling + large attachments to
watch out for (estimate per client in DEPLOYMENT.md).

## History

- 2026-09-01: creation (user requirement — R2 archiving at the end of
  email extraction); SigV4 stdlib validated for real.
