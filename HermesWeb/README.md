# 🌐 HermesWeb — WebApp backoffice clients PME

Volet **web** de la fabrique Hermes : sert les données du pipeline
(`cap_*` Supabase, GED R2) aux end users — backoffice et terrain
(desktop + mobile). Déploiement : **1 seul service Cloud Run (GCP)**
(front Next.js + API route handlers dans la même app).

## 🧱 Stack

| Couche | Choix |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript strict + Tailwind v4 |
| UI | shadcn/ui (CLI v4) — tokens + primitives centralisés dans `packages/ui` |
| API | Route Handlers `app/api/v1/*` + lib interne (`src/lib/`) |
| Contrats | `openapi/openapi.yaml` **généré depuis le SQL** → `openapi-typescript` → types |
| Validation runtime | Ajv (le YAML 3.1 = JSON Schema 2020-12) — pas de Zod |
| Client HTTP | `openapi-fetch` typé, same-origin |
| Auth | Supabase Auth via `@supabase/ssr` (session cookie) |

## 📂 Structure

```
HermesWeb/
├── apps/web/               ← Next.js (app + API dans le même déploiement)
├── packages/ui/            ← design system : tokens @theme + primitives shadcn
├── packages/api-types/     ← GÉNÉRÉ : schema.d.ts + database.types.ts
├── openapi/
│   ├── openapi.config.ts   ← exposition (tables, exclusions, opérations)
│   └── openapi.yaml        ← GÉNÉRÉ — jamais édité à la main
└── scripts/                ← générateur + tests (Vitest)
```

## 🔁 Pipeline des contrats (source de vérité = SQL)

```
HermesCapabilities/sql/generic/*.sql   (réalité des données, D9)
  ① supabase gen types  → packages/api-types/src/generated/database.types.ts
  ② scripts/generate-openapi.ts
       (parse DDL + CHECK enums + openapi.config.ts)
                        → openapi/openapi.yaml
  ③ openapi-typescript  → packages/api-types/src/generated/schema.d.ts
  ④ CI : pnpm gen:check → FAIL si SQL/YAML/types désynchronisés
```

```bash
pnpm gen-all      # régénère tout (①②③)
pnpm gen:check    # vérifie la non-dérive (utilisé en CI)
pnpm dev          # apps/web en dev
pnpm build && pnpm test
pnpm tsx scripts/bootstrap-admin.ts <email>   # compte admin webapp (one-off)
./scripts/deploy.sh test   # déploiement Cloud Run (voir .env.test.example)
```

## 🔒 Sécurité (invariants)

- Secrets **jamais** dans le repo : `.env.local` (dev), Secret Manager (Cloud Run)
- Service key Supabase **server-only** (route handlers) — RLS deny-all inchangée
- Colonnes exclues du contrat : `cap_documents.embedding`, `cap_clients.rpc_secret`
- Multi-tenant : `client_slug` déduit de l'utilisateur connecté (`app_users`,
  migration `sql/generic/007_app_users.sql` — à appliquer via le runner D9)

## 🗺️ Phases

| Phase | Contenu | Statut |
|---|---|---|
| P0 | Scaffolding monorepo + CI | ✅ |
| P1 | Pipeline contrats SQL→OpenAPI→types | ✅ |
| P2 | Migrations `007_app_users` + `008_rpc_web_search` (runner D9) | ✅ appliquées |
| P3 | Route Handlers v1 (14 routes, auth, Ajv, search R2/GED, admin) | ✅ |
| P4 | UI (login, dashboard, factures + validation D6, emails, recherche, admin) | ✅ |
| P5 | Déploiement Cloud Run (Dockerfile standalone + `deploy.sh`) | ✅ TEST déployé |
| P6+ | PWA (Serwist) · Capacitor · pont Hermes (Tailscale) | ⏳ |

> Test : https://hermesweb-test-REDACTED-ew.a.run.app — auth active, il reste
> à coller la `sb_secret_` (dashboard Supabase) dans `.env.test` puis re-`deploy.sh test`.

Décisions : [`DECISIONS.md`](DECISIONS.md)

## 🔌 API v1 (routes, contractées par openapi.yaml)

- `GET /api/v1/me` — rôle + client (mapping `app_users`)
- `GET /api/v1/factures[?statut=]` · `GET/PATCH /api/v1/factures/{id}`
  — PATCH = **transition de statut uniquement** (D6)
- `GET /api/v1/emails[?status=]` · `GET /api/v1/emails/{id}` · `GET /api/v1/chains`
- `GET /api/v1/documents[?thread_id=]` · `POST /api/v1/documents/search`
  (recherche RAG : embeddings miroir pipeline + `rpc_web_doc_search`)
- `GET /api/v1/runs` (D11) · `GET /api/v1/files/{documentId}` (R2 presign)
- Admin : `GET /api/v1/admin/clients` · `GET/POST /api/v1/admin/users` ·
  `DELETE /api/v1/admin/users/{userId}`

En local sans secrets, les routes répondent `503 supabase_unconfigured`
(comportement attendu — voir `.env.example`).
