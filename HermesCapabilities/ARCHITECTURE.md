# 🏗️ HermesCapabilities Architecture

Status: v1 (30/08/2026) — pilot capability `rag-supabase` (C5). This document
defines the **capability contract**, the **technical decision process**
and the **cross-cutting security rules**.

---

## 1. The capability contract — `manifest.yaml`

Each capability is described by a declarative manifest. It is the **single
source of truth** consumed by `capability-attach.sh` (and eventually by the
HermesConfig v3 spawn):

| Field | Type | Required | Role |
|---|---|---|---|
| `id` | str | ✅ | kebab-case identifier, **must = folder name** (except TEMPLATE) |
| `version` | str | ✅ | Semver — bump on every contract change |
| `title` | str | ✅ | Human title |
| `type` | enum | ✅ | `natif` \| `mix` \| `sidecar` (cf. §2) |
| `description` | str | ✅ | Business competence provided |
| `secrets` | list[str] | ✅ (empty ok) | **Names** of variables expected in `clients/<slug>/client.env` (never values here) |
| `env` | map | ✅ (empty ok) | Non-secret vars injected into the instance — `{{CLIENT_SLUG}}` interpolation supported |
| `mcp` | list[str] | ✅ (empty ok) | Hermes MCP servers to activate → `mcp.json` required if non-empty |
| `skills` | list[str] | ✅ (empty ok) | Hermes skills installed → `skill.md` required if non-empty |
| `routines` | list[str] | ✅ (empty ok) | Cron routines → `routine.yaml` required if non-empty |
| `code` | list[str] | ✅ (empty ok, v1.1) | **Deterministic** modules (stdlib Python, fixtures) → `code/` required if non-empty; copied to `data/code/<id>/` by the attach |
| `mounts` | map | ✅ (empty ok) | Additional volumes (host → container) |
| `soul_addendum` | str | ✅ | Clauses file merged into the client SOUL.md (default `soul-addendum.md`) |
| `tests` | str | ✅ | Tests folder (default `tests/`) |

**Enforced consistency** (checked by `capability-test.sh`):
- `mcp` non-empty → `mcp.json` present
- `skills` non-empty → `skill.md` present
- `routines` non-empty → `routine.yaml` present
- `soul-addendum.md` always contains **knows / can / refuses** clauses
- `decision.md` contains a `natif`, `mix` or `sidecar` verdict

## 2. Technical decision process — NATIVE > MIX > SIDECAR

For each capability, the solution is chosen in this order of preference,
**documented in `decision.md` and re-checked at every Hermes version bump**
(the MCP catalogue and bundled skills evolve fast):

1. **Native** — existing Hermes covers the need: MCP from the catalogue
   (`hermes mcp catalog`), bundled skill, cron routine, gateway. Zero custom
   code, everything lives in the agent container.
2. **Mix** — Hermes orchestrates (skill + routine + MCP), but one external
   brick is needed: SaaS API (Firecrawl, embeddings), uncatalogued community
   MCP. No extra container.
3. **Sidecar** — separate containerized service (Python worker, Tesseract…)
   exposed to the agent via MCP/REST. Last resort: custom code to maintain,
   extra attack surface.

### Availability matrix (state of play 30/08/2026, Hermes v0.20.6)

| Capability | Native | Initial verdict |
|---|---|---|
| **rag-supabase** (C5) | ✅ MCP `supabase` in the catalogue ("Database, auth, storage") | **Native** |
| **db-crud-sync** (C7) | ✅ same `supabase` MCP | **Native** |
| **analysis-facturation** (C6) | ✅ Bot role + custom skill + routine | **Native** |
| **email-processing** (C2) | ✅ Custom LLM-driven skill | **Native** |
| **email-gmail** (C1) | ❌ No Gmail in the MCP catalog | **Mix** — community Gmail MCP to evaluate, otherwise OAuth skill (pattern `SUREN_GMAIL_OAUTH_*` already in `/etc/secrets/`) + routine |
| **doc-ocr** (C3) | ❌ No Firecrawl (catalog nor code v0.20.6) | **Mix** — 2 vision extractors (Gemini + OpenRouter, different families) + 2 separate judges (D14); Tesseract sidecar discarded |
| **rag-embeddings** (C4) | ❌ No embeddings primitive (memory ≠ RAG docs) | **Mix** — embeddings API (Gemini/OpenRouter) + save via supabase MCP |

> ⚠️ Hermes memory (`MEMORY.md`/mem0 providers…) handles **conversation facts
> and preferences**, not a RAG of business documents. The RAG
> pipeline remains a dedicated build.

## 3. Per-client variabilization

- Any client-specific value lives in `HermesConfig/clients/<slug>/client.env` (600, outside git).
- Manifests reference secret **names**, never values.
- The `{{CLIENT_SLUG}}` interpolation in `env:` is replaced by the slug at attach time.
- The same capability attaches to N clients without forking: each client has its own credentials + RPCs.

## 4. Cross-cutting security (non-negotiable)

1. **Supabase**: never the `service key` in an agent. Access via MCP +
   **RLS + generic RPCs** (`rpc_cap_*` with slug + `CLIENT_RPC_SECRET`), key = limited
   publishable. Separate **test** Supabase project for unit tests.
2. **Gmail**: minimal OAuth scope (`gmail.readonly` + labels), one
   aliased account/address per client, refresh token in `client.env` (600).
3. **OCR/embeddings**: API keys per capability in `client.env` (600),
   quotas and costs documented in the capability README.
4. **Mandatory soul-addendum**: each capability adds its
   knows/can/refuses clauses — merged with idempotent markers
   `<!-- capability:<id>:start|end -->` in the client's SOUL.md.
5. **Secrets never in CLI/YAML/git**: `capability-attach.sh` validates by
   counting non-empty values, never displaying them.
6. **Tests**: contracts executed locally without secrets; integration
   tests (VPS, real APIs) SKIP cleanly outside the VPS.

## 5. Interface with HermesConfig

- `HermesCapabilities/scripts/` operates on the **neighbouring** HermesConfig
  (`../HermesConfig/` — VPS mirror `/home/admin/hermes-fleet/`).
- `capability-attach.sh <slug> <caps...>` reads `clients/<slug>/client.env`,
  configures the instance (`instances/<slug>/`), and keeps
  `instances/<slug>/capabilities.yaml` (state) up to date.
- Full contract: [`integration-hermesconfig.md`](integration-hermesconfig.md).

## 6. Roadmap

| Milestone | Content | Status |
|---|---|---|
| **M1** | Architecture + TEMPLATE + pilot `rag-supabase` (contract) + scripts + contract tests | 🔄 in progress |
| **M2** | Real implementation of C5 (MCP + RPC + VPS tests), then C1 email-gmail | ⏳ |
| **M3** | Replication of the pattern on C2/C3/C4/C6/C7 + business pipelines | ⏳ |
| **M4** | HermesInstances (the stables) consume HermesConfig + capabilities | ⏳ |
