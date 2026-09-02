---
name: rag-search
description: >-
  Recherche par similarité dans le RAG Supabase du client (pgvector via MCP
  supabase, RPC génériques). À utiliser quand l'agent a besoin de retrouver des
  documents/extraits indexés (emails, pièces jointes, notes) pour répondre
  à une demande métier.
---

# Skill rag-search

> ⚠️ Emplacement exact des skills custom dans l'instance dockerisée à valider
> en M2 (`hermes skills --help` + essai sur `hermes-arev-pro`). L'attach
> copie ce fichier vers `data/skills/rag-search/SKILL.md` (best-effort).

## Rôle

Retrouver les documents pertinents dans la base RAG du client (Supabase
pgvector) pour ancrer les réponses de l'agent sur ses documents métier.

## Quand l'utiliser

- Demande utilisateur portant sur des documents passés (« retrouve le devis… »)
- Avant de répondre à une question factuelle du périmètre documents
- Dans les routines d'analyse (ex: facturation — croiser avec les documents indexés)

## Procédure

1. Construire la requête de recherche : reformuler la demande en texte
   compact (une requête = une intention).
2. Obtenir l'embedding de la requête (capability `rag-embeddings`).
3. Appeler la RPC dédiée via MCP `supabase` :
   `rpc_cap_doc_search(slug, secret, query_embedding, match_count)` — **jamais de SQL
   direct**, jamais d'autre schéma que `cap_<slug>`.
4. Restituer : titre, source, date, extrait pertinent (citer, ne pas
   inventer). Si aucun résultat pertinent (score faible) → le dire.

## Limites

- Le RAG ne contient que ce qui a été indexé — ne pas présenter une absence
  de résultat comme une vérité métier.
- Toute écriture passe par `rpc_cap_doc_upsert` / (`doc_delete` à ajouter si besoin) (capability
  rag-supabase), jamais de DDL.
