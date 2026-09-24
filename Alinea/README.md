# 🌐 Alinea — WebApp backoffice for SMB clients

**Web** part of the Hermes factory: serves pipeline data
(`cap_*` Supabase, R2 DMS) to end users — backoffice and field
(desktop + mobile). Deployment: **a single Cloud Run service (GCP)**
(Next.js front + API route handlers in the same app).

## 🧱 Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + strict TypeScript + Tailwind v4 |
| UI | shadcn/ui (CLI v4) — tokens + primitives centralized in `packages/ui` |
| API | Route Handlers `app/api/v1/*` + internal lib (`src/lib/`) |
| Contracts | `openapi/openapi.yaml` **generated from the SQL** → `openapi-typescript` → types |
| Runtime validation | Ajv (YAML 3.1 = JSON Schema 2020-12) — no Zod |
| HTTP client | Typed `openapi-fetch`, same-origin |
| Auth | Supabase Auth via `@supabase/ssr` (session cookie) |

## 📂 Structure

```
Alinea/
├── apps/web/               ← Next.js (app + API in the same deployment)
├── packages/ui/            ← design system: @theme tokens + shadcn primitives
├── packages/api-types/     ← GENERATED: schema.d.ts + database.types.ts
├── openapi/
│   ├── openapi.config.ts   ← exposure (tables, exclusions, operations)
│   └── openapi.yaml        ← GENERATED — never edited by hand
└── scripts/                ← generator + tests (Vitest)
```

## 🔁 Contract pipeline (source of truth = SQL)

```
HermesCapabilities/sql/generic/*.sql   (data reality, D9)
  ① supabase gen types  → packages/api-types/src/generated/database.types.ts
  ② scripts/generate-openapi.ts
       (parse DDL + CHECK enums + openapi.config.ts)
                        → openapi/openapi.yaml
  ③ openapi-typescript  → packages/api-types/src/generated/schema.d.ts
  ④ CI: pnpm gen:check → FAIL if SQL/YAML/types drift
```

```bash
pnpm gen-all      # regenerates everything (①②③)
pnpm gen:check    # checks for no drift (used in CI)
pnpm dev          # apps/web in dev
pnpm build && pnpm test
pnpm tsx scripts/bootstrap-admin.ts <email>   # webapp admin account (one-off)
./scripts/deploy.sh test   # Cloud Run deployment (see .env.test.example)
```

## 🔒 Security (invariants)

- Secrets **never** in the repo: `.env.local` (dev), Secret Manager (Cloud Run)
- Supabase service key **server-only** (route handlers) — unchanged deny-all RLS
- Columns excluded from the contract: `cap_documents.embedding`, `cap_clients.rpc_secret`
- Multi-tenant: `client_slug` derived from the logged-in user (`app_users`,
  migration `sql/generic/007_app_users.sql` — to be applied via the D9 runner)

## 🗺️ Phases

| Phase | Content | Status |
|---|---|---|
| P0 | Monorepo scaffolding + CI | ✅ |
| P1 | Contract pipeline SQL→OpenAPI→types | ✅ |
| P2 | Migrations `007_app_users` + `008_rpc_web_search` (D9 runner) | ✅ applied |
| P3 | Route Handlers v1 (14 routes, auth, Ajv, R2/GED search, admin) | ✅ |
| P4 | UI (login, dashboard, invoices + D6 validation, emails, search, admin) | ✅ |
| P5 | Cloud Run deployment (standalone Dockerfile + `deploy.sh`) | ✅ TEST deployed |
| P6+ | PWA (Serwist) · Capacitor · Hermes bridge (Tailscale) | ⏳ |

> Test: https://alinea-test-REDACTED-ew.a.run.app — auth active; remaining
> step: paste the `sb_secret_` (Supabase dashboard) into `.env.test` then re-run `deploy.sh test`.

Decisions: [`DECISIONS.md`](DECISIONS.md)

## 🔌 API v1 (routes, covered by openapi.yaml)

- `GET /api/v1/me` — role + client (`app_users` mapping)
- `GET /api/v1/factures[?statut=]` · `GET/PATCH /api/v1/factures/{id}`
  — PATCH = **status transition only** (D6)
- `GET /api/v1/emails[?status=]` · `GET /api/v1/emails/{id}` · `GET /api/v1/chains`
- `GET /api/v1/documents[?thread_id=]` · `POST /api/v1/documents/search`
  (RAG search: embeddings mirroring the pipeline + `rpc_web_doc_search`)
- `GET /api/v1/runs` (D11) · `GET /api/v1/files/{documentId}` (R2 presign)
- Admin: `GET /api/v1/admin/clients` · `GET/POST /api/v1/admin/users` ·
  `DELETE /api/v1/admin/users/{userId}`

Locally without secrets, routes answer `503 supabase_unconfigured`
(expected behavior — see `.env.example`).
