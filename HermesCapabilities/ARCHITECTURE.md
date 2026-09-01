# 🏗️ Architecture HermesCapabilities

Statut : v1 (30/08/2026) — capability pilote `rag-supabase` (C5). Ce document
définit le **contrat de capability**, le **processus de décision technique**
et les **règles de sécurité transversales**.

---

## 1. Le contrat de capability — `manifest.yaml`

Chaque capability est décrite par un manifest déclaratif. C'est **l'unique
source de vérité** consommée par `capability-attach.sh` (et à terme par le
spawn HermesConfig v3) :

| Champ | Type | Obligatoire | Rôle |
|---|---|---|---|
| `id` | str | ✅ | Identifiant kebab-case, **doit = nom du dossier** (sauf TEMPLATE) |
| `version` | str | ✅ | Semver — bump à chaque changement de contrat |
| `title` | str | ✅ | Titre humain |
| `type` | enum | ✅ | `natif` \| `mix` \| `sidecar` (cf. §2) |
| `description` | str | ✅ | Compétence métier apportée |
| `secrets` | list[str] | ✅ (vide ok) | **Noms** de variables attendues dans `clients/<slug>/client.env` (jamais de valeurs ici) |
| `env` | map | ✅ (vide ok) | Vars non secrètes injectées dans l'instance — interpolation `{{CLIENT_SLUG}}` supportée |
| `mcp` | list[str] | ✅ (vide ok) | MCP servers Hermes à activer → `mcp.json` requis si non vide |
| `skills` | list[str] | ✅ (vide ok) | Skills Hermes installées → `skill.md` requis si non vide |
| `routines` | list[str] | ✅ (vide ok) | Routines cron → `routine.yaml` requis si non vide |
| `code` | list[str] | ✅ (vide ok, v1.1) | Modules **déterministes** (stdlib Python, fixtures) → `code/` requis si non vide ; copiés vers `data/code/<id>/` par l'attach |
| `mounts` | map | ✅ (vide ok) | Volumes additionnels (host → container) |
| `soul_addendum` | str | ✅ | Fichier de clauses mergé dans le SOUL.md client (défaut `soul-addendum.md`) |
| `tests` | str | ✅ | Dossier de tests (défaut `tests/`) |

**Cohérence imposée** (vérifiée par `capability-test.sh`) :
- `mcp` non vide → `mcp.json` présent
- `skills` non vide → `skill.md` présent
- `routines` non vide → `routine.yaml` présent
- `soul-addendum.md` contient toujours des clauses **sait / peut / refuse**
- `decision.md` contient un verdict `natif`, `mix` ou `sidecar`

## 2. Processus de décision technique — NATIF > MIX > SIDECAR

Pour chaque capability, la solution est choisie dans cet ordre de préférence,
**documentée dans `decision.md` et re-vérifiée à chaque montée de version
Hermes** (le catalogue MCP et les skills bundlées évoluent vite) :

1. **Natif** — l'existant Hermes couvre le besoin : MCP du catalogue
   (`hermes mcp catalog`), skill bundlée, routine cron, gateway. Zéro code
   custom, tout vit dans le conteneur agent.
2. **Mix** — Hermes orchestre (skill + routine + MCP), mais une brique
   externe est nécessaire : API SaaS (Firecrawl, embeddings), MCP
   communautaire non catalogué. Pas de conteneur supplémentaire.
3. **Sidecar** — service containerisé séparé (worker Python, Tesseract…)
   exposé à l'agent via MCP/REST. Dernier recours : code custom à maintenir,
   surface d'attaque supplémentaire.

### Matrice de disponibilité (état des lieux 30/08/2026, Hermes v0.20.6)

| Capability | Natif | Verdict initial |
|---|---|---|
| **rag-supabase** (C5) | ✅ MCP `supabase` dans le catalogue ("Database, auth, storage") | **Natif** |
| **db-crud-sync** (C7) | ✅ même MCP `supabase` | **Natif** |
| **analysis-facturation** (C6) | ✅ Bot role + skill custom + routine | **Natif** |
| **email-processing** (C2) | ✅ Skill custom LLM-driven | **Natif** |
| **email-gmail** (C1) | ❌ Pas de Gmail dans le MCP catalog | **Mix** — MCP Gmail communautaire à évaluer, sinon skill OAuth (pattern `SUREN_GMAIL_OAUTH_*` déjà dans `/etc/secrets/`) + routine |
| **doc-ocr** (C3) | ❌ Pas de Firecrawl (catalog ni code v0.20.6) | **Mix** — API Firecrawl ou Gemini Vision (`SUREN_GEMINI_API_KEY`), sidecar Tesseract en dernier recours |
| **rag-embeddings** (C4) | ❌ Pas de primitive embeddings (memory ≠ RAG docs) | **Mix** — API embeddings (Gemini/OpenRouter) + save via MCP supabase |

> ⚠️ La mémoire Hermes (`MEMORY.md`/providers mem0…) gère les **faits et
> préférences de conversation**, pas un RAG de documents métier. Le pipeline
> RAG reste une construction dédiée.

## 3. Variabilisation par client

- Toute valeur spécifique client vit dans `HermesConfig/clients/<slug>/client.env` (600, hors git).
- Les manifests référencent des **noms** de secrets, jamais de valeurs.
- L'interpolation `{{CLIENT_SLUG}}` dans `env:` est remplacée par le slug au moment de l'attachement.
- Une même capability s'attache à N clients sans fork : chaque client a ses propres credentials + RPC.

## 4. Sécurité transversale (non négociable)

1. **Supabase** : jamais la `service key` dans un agent. Accès via MCP +
   **RLS + RPC dédiées par client** (`rpc_cap_<slug>_*`), clé = rôle capability
   limité. Projet Supabase **test** séparé pour les tests unitaires.
2. **Gmail** : OAuth scope minimal (`gmail.readonly` + labels), un
   compte/adresse aliasé par client, refresh token dans `client.env` (600).
3. **OCR/embeddings** : clés API par capability dans `client.env` (600),
   quotas et coûts documentés dans le README de la capability.
4. **Soul-addendum obligatoire** : chaque capability ajoute ses clauses
   sait/peut/refuse — mergées avec marqueurs idempotents
   `<!-- capability:<id>:start|end -->` dans le SOUL.md du client.
5. **Secrets jamais en CLI/YAML/git** : `capability-attach.sh` valide par
   comptage de valeurs non vides, sans jamais les afficher.
6. **Tests** : contrats exécutés localement sans secrets ; les tests
   d'intégration (VPS, vraies API) SKIPent proprement hors VPS.

## 5. Interface avec HermesConfig

- `HermesCapabilities/scripts/` opère sur le HermesConfig **voisin**
  (`../HermesConfig/` — miroir VPS `/home/admin/hermes-fleet/`).
- `capability-attach.sh <slug> <caps...>` lit `clients/<slug>/client.env`,
  configure l'instance (`instances/<slug>/`), et tient à jour
  `instances/<slug>/capabilities.yaml` (état).
- Contrat complet : [`integration-hermesconfig.md`](integration-hermesconfig.md).

## 6. Roadmap

| Milestone | Contenu | Statut |
|---|---|---|
| **M1** | Architecture + TEMPLATE + pilote `rag-supabase` (contrat) + scripts + tests de contrat | 🔄 en cours |
| **M2** | Implémentation réelle C5 (MCP + RPC + tests VPS), puis C1 email-gmail | ⏳ |
| **M3** | Réplication du pattern sur C2/C3/C4/C6/C7 + pipelines métier | ⏳ |
| **M4** | HermesInstances (l'écurie) consomme HermesConfig + capabilities | ⏳ |
