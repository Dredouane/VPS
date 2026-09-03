---
name: expert-router
description: >-
  Chain of Experts — routeur : détermine si un email structuré concerne un
  des experts enregistrés (facturation, ...) et retourne la liste JSON
  stricte. Ne JAMAIS exécuter un expert directement — retourner la liste
  pour orchestration.
---

# Skill expert-router

## Rôle

Décider, pour chaque email structuré (sortie C2/C3), quels experts sont
concernés. Premier expert livré : facturation.

## Procédure

1. Entrées : mail structuré (C2 : role, new_content, classification,
   attachments) + verdict OCR (C3 : doc_type, invoice verdict).
2. Produire STRICTEMENT :

```json
{"experts": ["facturation"], "confidence": 0.0, "reason": "1 phrase"}
```

## Critères facturation (déterministes, M2)

- `doc_type == "facture"` (juge général C3) → expert facturation.
- OU catégorie classification == facturation ET (PJ facture OU mots-clés
  facture/numéro/TVA dans le contenu nouveau).

## Limites

- Liste vide = aucun expert (mail indexé en RAG, rien de plus).
- Le routeur ne décide PAS des montants — il route.
