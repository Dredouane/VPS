---
name: email-classify
description: >-
  Classification métier du contenu NOUVEAU d'un email structuré (sortie
  thread_parser) : catégorie, résumé, flags. À exécuter après le
  thread-parser, avant le routage experts. Ne jamais classifier l'historique
  cité (anti-doublon).
---

# Skill email-classify

## Rôle

Catégoriser le contenu nouveau de chaque mail structuré et produire le
résumé utilisé par le routage experts et le RAG.

## Procédure

1. Entrée : la sortie `thread_parser` (mails avec `rag_status: new`).
2. Pour chaque mail nouveau, produire **strictement** :

```json
{"message_id": "<msg@x>", "categorie": "facturation|devis|chantier|admin|autre",
 "resume": "1 phrase", "flags": ["pj-facture", "urgent"]}
```

3. Le résumé porte sur le contenu nouveau uniquement — jamais sur l'historique
   cité (déjà en RAG ou refusé, cf. D3).

## Limites

- La classification n'engage rien : les experts décident en aval
  (`expert-router`).
- Sortie invalide (JSON manquant) → statut `error` sur le mail (email_upsert)
  et escalade — pas de retry LLM silencieux.
