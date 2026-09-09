# 📜 DECISIONS.md — Registre des décisions Alinea

> Style ADR (comme `HermesCapabilities/DECISIONS.md`). Session
> « stack webapp » du 06/09/2026 — recherche 2026 documentée, arbitrages
> validés par l'utilisateur. Ne pas rouvrir sans nouvelle leçon.

---

## Table récapitulative

| # | Décision | Alternative rejetée |
|---|---|---|
| W1 | **Next.js 16 App Router** (front + API route handlers, 1 app) | Vite SPA + Hono séparé · Remix · TanStack Start |
| W2 | **openapi.yaml généré depuis le SQL** (générateur maison + config) | Zod source de vérité (surcharge) · YAML écrit à la main |
| W3 | **openapi-fetch** (~6 KB) + openapi-typescript | hey-api SDK (plus lourd) · Orval · Kubb |
| W4 | **1 seul service Cloud Run** (Hono→abandonné ; Next standalone sert front+API) | 2 services (front/back séparés) |
| W5 | Auth **Supabase + @supabase/ssr** (cookie), rôles via `app_users` | Bearer JWT manuel · Better Auth · Auth.js |
| W6 | Validation runtime **Ajv** compilée du YAML | Zod · validation manuelle par handler |
| W7 | Monorepo **pnpm + Turborepo**, design tokens dans `packages/ui` | App Next unique sans packages · MUI/Mantine |
| W8 | Mobile : **responsive d'abord**, PWA (Serwist) ensuite, Capacitor si besoin | Expo/React Native dès v1 |

## W1 — Next.js 16, une seule app ✅

Décision utilisateur (revue du plan) : Next.js App Router + TypeScript strict +
shadcn/ui + Tailwind. Route Handlers = backend (pas de service séparé).
Vite/SPA/Hono **rejetés** par l'utilisateur malgré la recommandation initiale :
priorité à un framework unique, standard, avec un seul déploiement et
l'écosystème le mieux outillé pour agents de code (AGENTS.md natif).
`output: 'standalone'` pour Cloud Run.

## W2 — openapi.yaml GÉNÉRÉ depuis le SQL ✅

Décision utilisateur : « tu génères / maintiens openapi.yaml à partir du SQL ;
tu ne me demandes pas de maintenir le YAML à la main ». Le pipeline :

1. `supabase gen types` → `database.types.ts` (①, CLI liée requise)
2. `scripts/generate-openapi.ts` : parse DDL borné (`sql/generic/`) → tables,
   colonnes, nullabilité, **enums CHECK**, commentaires → descriptions ;
   `openapi.config.ts` déclare l'exposition (ressources, exclusions,
   opérations) → `openapi.yaml` (②)
3. `openapi-typescript` → `schema.d.ts` (③)
4. `pnpm gen:check` en CI : régénère et `git diff --exit-code` (④)

Rejeté : Zod comme couche de contrats (jugé surchargeant par l'utilisateur —
double langage de schéma) ; openapi.yaml maintenu à la main (dérive garantie).
Tests du parseur : contre le SQL RÉEL du repo (18 tests, Vitest).

## W3 — openapi-fetch ✅

Client typé minimal (~6 KB, `{data, error, response}`), alimenté par les types
générés. hey-api écarté (SDK plus volumineux, plugins inutiles ici — recherche
2026 : comparatif openapi-typescript/hey-api/Orval/Kubb).

## W4 — Un seul service Cloud Run ✅

Décision utilisateur. Le script de déploiement s'inspire du pattern d'un autre
projet (`.env.<env>` + `set -a`, BUILD_ID git, `--set-secrets`, nettoyage
Artifact Registry keep-3) — adapté : plus de vérif backend séparé ni
`NEXT_PUBLIC_API_URL` (same-origin). Rejeté : 2 services (CORS, 2 URLs,
2 images).

## W5 — Auth Supabase, rôles via app_users ✅

`@supabase/ssr` (session cookie) = pattern canonique Next×Supabase. La table
`public.app_users` (migration 007, à appliquer via le runner D9) mappe
`auth.users` ↔ `client_slug` ↔ rôle (`admin`/`backoffice`/`terrain`).
Scoping multi-tenant en code (service key server-side, RLS deny-all inchangée,
D8-v3). Rôles et colonnes exclus du contrat API : `rpc_secret`, `embedding`.

## W6 — Validation runtime Ajv ✅

Le YAML 3.1 est du JSON Schema 2020-12 : Ajv compile les composants, un
wrapper `withValidation(operationId, handler)` valide bodies/params dans les
route handlers. Pas de Zod (W2). 404/400/401 = enveloppe `Error` du contrat.

## W7 — Monorepo minimal + design centralisé ✅

pnpm workspaces + Turborepo (`apps/web`, `packages/ui`,
`packages/api-types`). shadcn CLI v4 en mode monorepo officiel ; tokens
`@theme` (Tailwind v4) dans `packages/ui/src/styles/globals.css` : revoir le
design = retoucher tokens + primitives, les pages restent stables. Sobre/pro
(base neutral, accents success/warning pour les statuts métier).

## W8 — Mobile progressif ✅

Phase 1 : responsive (shadcn). Phase 2 : PWA (Serwist — installable, offline
shell). Capacitor 8 si stores/push natif. Expo/RN rejeté (2ᵉ paradigme de
rendu, coût double — recherche 2026 : consensus LOB « PWA first »).

## W9 — Lecteurs webapp SQL : namespace `rpc_web_*` scellé par GRANT ✅ (P2/P3)

Les RPC `rpc_cap_*` exigent `(slug, rpc_secret)` — modèle AGENT. La webapp
(D8-v3 : service key) n'a PAS les secrets agents. Deux namespaces distincts :

- `rpc_cap_*` — agent, publishable + secret, `grant anon, authenticated`
- `rpc_web_*` — webapp, **pas de secret**, `revoke public/anon/authenticated`
  + `grant execute to service_role` uniquement (001 lecture vectorielle
  impossible via PostgREST : opérateur `<=>`)

`008_rpc_web_search.sql` : `rpc_web_doc_search(p_client_slug, p_query_embedding,
p_match_count, p_kind)`. L'invariant du runner (« RPC per-slug: 0 ») reste
intact. Pas de JWT par client (D8-bis) tant que le scoping en code suffit.

## W10 — Embeddings webapp = miroir EXACT du pipeline ✅ (P3)

Le code pipeline (M2.6) utilise `gemini-embedding-001` + `outputDimensionality:
768` (évolution du texte D5 qui citait text-embedding-004) — la recherche
webapp reproduit le même modèle, la même dimension, la même troncation
(6000 chars), sinon l'espace vectoriel diverge.

## W11 — PATCH facture = transition de statut uniquement ✅ (P3)

D6 appliqué strictement : le handler ne mappe que `{ statut }` (l'appartenance
à l'enum CHECK est garantie par la validation Ajv du contrat). Les autres
champs de FactureUpdate sont refusés (`400 statut_required`). Scoping
`client_slug` systématique (jamais pris de la requête).

## W12 — GED : `metadata.r2_key` à produire par le pipeline (évolution) ⏳

Le pipeline M2.6 archive les bruts dans R2 mais n'écrit pas la clé objet dans
`cap_documents.metadata` (metadata actuelles : from/date/classification/
pipeline_version). En attendant : `GET /files/{documentId}` renvoie
`404 r2_key_unavailable` si la clé manque. Évolution : `doc_upsert` avec
`r2_key` dans metadata (additif, non bloquant — échec R2 déjà non bloquant).

## W13 — Bootstrap admin : SQL direct via psql admin ✅ (P4)

`auth.users`/`auth.identities` insérés via l'URL postgres admin (pattern
runner D9) — pas besoin de service key pour la mise en service. Piège
découvert : GoTrue de ce projet filtre par `instance_id` — il DOIT valoir
`00000000-0000-0000-0000-000000000000` sinon « Invalid login credentials »
malgré un hash bcrypt correct. `scripts/bootstrap-admin.ts` (REST admin)
demande la service key — alternative quand elle sera configurée.

## W14 — NEXT_PUBLIC_* : build-time ET runtime ✅ (P5)

Le bundle client inline les NEXT_PUBLIC_* au build (`.env.production`,
pattern surenSaas + trap cleanup) ; les route handlers les lisent au
runtime → elles sont donc aussi passées en `--set-env-vars` Cloud Run.
Secrets sensibles : Secret Manager (`alinea-*`) via `--set-secrets`.
La service key du projet Hermes (`sb_secret_`) n'existe que dans le
dashboard Supabase — seule action utilisateur restante pour activer l'API
en TEST (le deploy.sh la propage ensuite).

## W15bis — Chat : `now()` Postgres + pooler transaction-mode = ordre non fiable ✅ (fix)

`now()`/`default now()` via le pooler transaction-mode (port 6543) a produit
des `created_at` légèrement antérieurs pour l'assistant inséré après la
question → le front affichait la réponse avant la question. Fix double :
`created_at` **explicites** côté serveur (horloge Node, avant/après le LLM)
+ tiebreaker `role desc` au tri. Les paires historiques inversées ont été
corrigées par swap SQL one-off (candidates : assistant immédiatement suivi
d'un user, Δ<10 s, sans message intermédiaire).

## Historique

- 2026-09-06 : création (session stack webapp) — P0/P1, puis P2 (007+008
  appliquées via runner) et P3 (route handlers v1, 14 routes), P4 (UI) et P5 (Cloud Run test).
