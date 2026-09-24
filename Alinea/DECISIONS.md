# 📜 DECISIONS.md — Alinea decision registry

> ADR style (like `HermesCapabilities/DECISIONS.md`). "Webapp stack"
> session of 06/09/2026 — documented 2026 research, trade-offs
> validated by the user. Do not reopen without a new lesson.

---

## Summary table

| # | Decision | Rejected alternative |
|---|---|---|
| W1 | **Next.js 16 App Router** (front + API route handlers, 1 app) | Vite SPA + separate Hono · Remix · TanStack Start |
| W2 | **openapi.yaml generated from the SQL** (in-house generator + config) | Zod as source of truth (overhead) · hand-written YAML |
| W3 | **openapi-fetch** (~6 KB) + openapi-typescript | hey-api SDK (heavier) · Orval · Kubb |
| W4 | **A single Cloud Run service** (Hono→dropped; Next standalone serves front+API) | 2 services (separate front/back) |
| W5 | Auth **Supabase + @supabase/ssr** (cookie), roles via `app_users` | Manual Bearer JWT · Better Auth · Auth.js |
| W6 | Runtime validation **Ajv** compiled from the YAML | Zod · manual validation per handler |
| W7 | Monorepo **pnpm + Turborepo**, design tokens in `packages/ui` | Single Next app without packages · MUI/Mantine |
| W8 | Mobile: **responsive first**, PWA (Serwist) next, Capacitor if needed | Expo/React Native from v1 |

## W1 — Next.js 16, a single app ✅

User decision (plan review): Next.js App Router + strict TypeScript +
shadcn/ui + Tailwind. Route Handlers = backend (no separate service).
Vite/SPA/Hono **rejected** by the user despite the initial recommendation:
priority to a single, standard framework, with a single deployment and
the best-tooled ecosystem for code agents (native AGENTS.md).
`output: 'standalone'` for Cloud Run.

## W2 — openapi.yaml GENERATED from the SQL ✅

User decision: "you generate / maintain openapi.yaml from the SQL;
you do not ask me to maintain the YAML by hand". The pipeline:

1. `supabase gen types` → `database.types.ts` (①, linked CLI required)
2. `scripts/generate-openapi.ts`: bounded DDL parse (`sql/generic/`) → tables,
   columns, nullability, **CHECK enums**, comments → descriptions;
   `openapi.config.ts` declares the exposure (resources, exclusions,
   operations) → `openapi.yaml` (②)
3. `openapi-typescript` → `schema.d.ts` (③)
4. `pnpm gen:check` in CI: regenerate and `git diff --exit-code` (④)

Rejected: Zod as the contract layer (considered overhead by the user —
double schema language); openapi.yaml maintained by hand (guaranteed drift).
Parser tests: against the REAL SQL of the repo (18 tests, Vitest).

## W3 — openapi-fetch ✅

Minimal typed client (~6 KB, `{data, error, response}`), fed by the generated
types. hey-api set aside (bulkier SDK, useless plugins here — 2026
research: openapi-typescript/hey-api/Orval/Kubb comparison).

## W4 — A single Cloud Run service ✅

User decision. The deployment script is inspired by the pattern of another
project (`.env.<env>` + `set -a`, git BUILD_ID, `--set-secrets`, Artifact
Registry keep-3 cleanup) — adapted: no more separate backend check nor
`NEXT_PUBLIC_API_URL` (same-origin). Rejected: 2 services (CORS, 2 URLs,
2 images).

## W5 — Supabase Auth, roles via app_users ✅

`@supabase/ssr` (session cookie) = canonical Next×Supabase pattern. The
`public.app_users` table (migration 007, to be applied via the D9 runner) maps
`auth.users` ↔ `client_slug` ↔ role (`admin`/`backoffice`/`terrain`).
Multi-tenant scoping in code (service key server-side, unchanged deny-all RLS,
D8-v3). Roles and columns excluded from the API contract: `rpc_secret`, `embedding`.

## W6 — Ajv runtime validation ✅

YAML 3.1 is JSON Schema 2020-12: Ajv compiles the components, a
`withValidation(operationId, handler)` wrapper validates bodies/params in the
route handlers. No Zod (W2). 404/400/401 = contract `Error` envelope.

## W7 — Minimal monorepo + centralized design ✅

pnpm workspaces + Turborepo (`apps/web`, `packages/ui`,
`packages/api-types`). shadcn CLI v4 in official monorepo mode; `@theme`
tokens (Tailwind v4) in `packages/ui/src/styles/globals.css`: revisiting the
design = touching tokens + primitives, the pages stay stable. Sober/pro
(base neutral, success/warning accents for business statuses).

## W8 — Progressive mobile ✅

Phase 1: responsive (shadcn). Phase 2: PWA (Serwist — installable, offline
shell). Capacitor 8 if native stores/push. Expo/RN rejected (a 2nd rendering
paradigm, double the cost — 2026 research: LOB consensus "PWA first").

## W9 — Webapp SQL readers: `rpc_web_*` namespace sealed by GRANT ✅ (P2/P3)

The `rpc_cap_*` RPCs require `(slug, rpc_secret)` — AGENT model. The webapp
(D8-v3: service key) does NOT have the agent secrets. Two distinct namespaces:

- `rpc_cap_*` — agent, publishable + secret, `grant anon, authenticated`
- `rpc_web_*` — webapp, **no secret**, `revoke public/anon/authenticated`
  + `grant execute to service_role` only (001 vector search
  impossible via PostgREST: `<=>` operator)

`008_rpc_web_search.sql`: `rpc_web_doc_search(p_client_slug, p_query_embedding,
p_match_count, p_kind)`. The runner invariant ("per-slug RPCs: 0") remains
intact. No per-client JWT (D8-bis) as long as in-code scoping suffices.

## W10 — Webapp embeddings = EXACT mirror of the pipeline ✅ (P3)

The pipeline code (M2.6) uses `gemini-embedding-001` + `outputDimensionality:
768` (evolution of the D5 text which cited text-embedding-004) — the webapp
search reproduces the same model, the same dimension, the same truncation
(6000 chars), otherwise the vector space diverges.

## W11 — Invoice PATCH = status transition only ✅ (P3)

D6 applied strictly: the handler maps only `{ statut }` (membership
in the CHECK enum is guaranteed by the Ajv contract validation). The other
FactureUpdate fields are rejected (`400 statut_required`). Systematic
`client_slug` scoping (never taken from the request).

## W12 — DMS: `metadata.r2_key` to be produced by the pipeline (evolution) ⏳

The M2.6 pipeline archives raw files in R2 but does not write the object key to
`cap_documents.metadata` (current metadata: from/date/classification/
pipeline_version). In the meantime: `GET /files/{documentId}` returns
`404 r2_key_unavailable` if the key is missing. Evolution: `doc_upsert` with
`r2_key` in metadata (additive, non-blocking — R2 failure already non-blocking).

## W13 — Admin bootstrap: direct SQL via psql admin ✅ (P4)

`auth.users`/`auth.identities` inserted via the postgres admin URL (D9 runner
pattern) — no need for a service key to bring the service up. Discovered
pitfall: this project's GoTrue filters by `instance_id` — it MUST equal
`00000000-0000-0000-0000-000000000000` otherwise "Invalid login credentials"
despite a correct bcrypt hash. `scripts/bootstrap-admin.ts` (REST admin)
asks for the service key — alternative once it is configured.

## W14 — NEXT_PUBLIC_*: build-time AND runtime ✅ (P5)

The client bundle inlines NEXT_PUBLIC_* at build (`.env.production`,
surenSaas pattern + trap cleanup); the route handlers read them at
runtime → they are therefore also passed via `--set-env-vars` on Cloud Run.
Sensitive secrets: Secret Manager (`alinea-*`) via `--set-secrets`.
The Hermes project service key (`sb_secret_`) exists only in the
Supabase dashboard — the only remaining user action to activate the API
in TEST (deploy.sh propagates it afterwards).

## W15bis — Chat: Postgres `now()` + transaction-mode pooler = unreliable ordering ✅ (fix)

`now()`/`default now()` via the transaction-mode pooler (port 6543) produced
`created_at` values slightly earlier for the assistant inserted after the
question → the front displayed the answer before the question. Double fix:
**explicit** `created_at` server-side (Node clock, before/after the LLM)
+ `role desc` tiebreaker when sorting. The inverted history pairs were
fixed with a one-off SQL swap (candidates: assistant immediately followed
by a user, Δ<10 s, no message in between).

## History

- 2026-09-06: creation (webapp stack session) — P0/P1, then P2 (007+008
  applied via runner) and P3 (route handlers v1, 14 routes), P4 (UI) and P5 (Cloud Run test).
