# Capability rag-supabase (C5) — pilote HermesCapabilities

**Type** : `natif` · **Statut** : contrat M1 validé — implémentation M2

Indexe les documents métier du client (texte extrait des emails/OCR) dans
Supabase pgvector et permet la recherche par similarité (RAG), via le MCP
`supabase` natif de Hermes. Clé d'accès limitée par RLS/RPC — jamais la
service key.

## Composants

| Fichier | Rôle |
|---|---|
| [manifest.yaml](manifest.yaml) | Contrat : secrets `SUPABASE_URL` + `SUPABASE_RPC_KEY`, MCP `supabase`, skill `rag-search` |
| [decision.md](decision.md) | Analyse natif/mix/sidecar (MCP catalog vérifié 30/08 v0.20.6) |
| [skill.md](skill.md) | Skill `rag-search` (recherche par similarité, RPC génériques) |
| [mcp.json](mcp.json) | Config MCP supabase (secrets par référence) |
| [soul-addendum.md](soul-addendum.md) | Clauses sait/peut/refuse/escalade |
| [tests/test.sh](tests/test.sh) | Contrat hérité TEMPLATE + checks C5 + intégration VPS |

## Secrets requis (dans `HermesConfig/clients/<slug>/client.env`, 600)

| Variable | Rôle |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase du client |
| `SUPABASE_RPC_KEY` | Clé du rôle capability (RLS + EXECUTE sur `rpc_cap_*`) — **jamais la service key** |

## À faire en M2 (implémentation)

> Design complet du pipeline : [`../../PIPELINE_EMAIL_AREV.md`](../../PIPELINE_EMAIL_AREV.md)
> · Schéma/RPC/RLS : [`../../sql/arev/`](../../sql/arev/) (source de vérité, D9)

1. Supabase : créer le schéma `cap_arev` (table `documents` + pgvector),
   le rôle capability (RLS), les RPC génériques `rpc_cap_doc_search|doc_upsert` (+ doc_delete à ajouter si besoin)
   — projet TEST d'abord, puis prod client.
2. Valider le wiring MCP sur `hermes-arev-pro` : `hermes mcp install supabase`
   + env (émuler `capability-attach.sh arev rag-supabase --dry-run` puis réel).
3. Valider l'emplacement/chargement de la skill custom (`data/skills/`).
4. Tests d'intégration VPS : upsert + search + delete sur le projet TEST.
5. Attacher à `arev` (état : `instances/arev/capabilities.yaml`), vérifier
   SOUL.md mergé, gateway reconnecté et sain.

## Coûts / quotas

Aucun coût direct C5 (Supabase existant). Les coûts d'embeddings sont portés
par C4 (`rag-embeddings`).

## Historique

- 2026-08-30 : création du contrat (M1, capability pilote)
