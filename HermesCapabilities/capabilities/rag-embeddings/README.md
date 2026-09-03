# Capability rag-embeddings (C4) — vecteurs 768d

**Type** : `mix` · **Statut** : M2.4 — code + tests, intégration réelle
(embed "test" → 768d vérifié)

Génère les vecteurs `text-embedding-004` (Gemini, **768d figé** — D5) des
contenus à indexer. Upsert RAG = C5 (`rpc_cap_doc_upsert`).

## Composants

| Fichier | Rôle |
|---|---|
| [manifest.yaml](manifest.yaml) | Contrat : secret VPS_GEMINI_API_KEY, code embed_gemini |
| [code/embed_gemini.py](code/embed_gemini.py) | embedContent stdlib, dimension vérifiée, troncature 6000 |
| [skill.md](skill.md) | Skill `rag-embed` |
| [soul-addendum.md](soul-addendum.md) | Refus : changer de modèle, indexer du vide |
| [tests/test.sh](tests/test.sh) | Unitaires (payload, parse, dimension) + intégration réelle |

## Secrets

`VPS_GEMINI_API_KEY` (bashrc local → client.env, 600).

## Historique

- 2026-09-01 : création (M2.4).
