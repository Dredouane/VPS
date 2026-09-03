# Decision — Capability rag-embeddings (C4)

> Règle d'ordre : **NATIF > MIX > SIDECAR** (ARCHITECTURE.md §2).

## Besoin

Générer les vecteurs 768d des contenus à indexer (mails nouveaux, OCR PJ)
pour le RAG — modèle FIGÉ (D5 : changer = réindexer tout).

## Options évaluées

| Option | Verdict |
|---|---|
| **Mix** : Gemini `text-embedding-004` (768d) via API stdlib — clé SUREN existante | ✅ **retenu** |
| OpenAI embeddings (1536d) | ❌ nouvelle clé + dimension ≠ schéma actuel |
| Embeddings locaux (Ollama) | ❌ brique de plus sur le VPS |
| DeepSeek | ❌ n'expose pas d'API embeddings |

## Décision

**MIX** — `embed_gemini.py` (stdlib) : `embedContent` avec dimension
vérifiée (768) et troncature 6000 chars. L'upsert passe par les RPC
génériques C5. Plan B si Google retire le modèle : ré-évaluer OpenAI
(migration = réindexation complète, D5).

## Re-vérification

| Date | Hermes | Verdict inchangé ? | Notes |
|---|---|---|---|
| 2026-09-01 | v0.20.6 | — (décision initiale) | intégration réelle 768d vérifiée |
