---
name: rag-embed
description: >-
  Génère le vecteur 768d (text-embedding-004) d'un contenu à indexer
  (mail nouveau, OCR de PJ) avant l'upsert RAG (C5). Modèle FIGÉ — changer
  = réindexation complète.
---

# Skill rag-embed

## Rôle

Produire l'embedding du contenu nouveau juste avant `rpc_cap_doc_upsert`.

## Procédure

```bash
python3 /opt/data/code/rag-embeddings/embed_gemini.py <contenu.txt>
```

Sortie JSON : `{"embedding": [768 floats], "model", "chars"}` — passer
l'embedding tel quel à `rpc_cap_doc_upsert(...)` (C5). Un contenu vide →
pas d'embedding (doc non indexé, consigné).

## Limites

- Troncature à `EMBED_MAX_CHARS` (6000) — chunking avancé hors scope M2.
- Modèle FIGÉ (D5) — jamais de changement sans migration RAG complète.
