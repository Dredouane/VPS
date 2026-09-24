---
name: ocr-attachments
description: >-
  Extraction OCR multi-provider des pièces jointes du spool (Gemini Vision +
  OpenRouter vision en parallèle), juge général déterministe, bifurcation
  facture (adaptateur SLM + check montants). À exécuter sur chaque PJ du
  pipeline email avant embeddings/RAG.
---

# Skill ocr-attachments

## Rôle

Obtenir la MEILLEURE extraction possible de chaque pièce jointe, avec un
verdict transparent (scores, sommes arithmétiques) — pour tout type de
document, pas seulement les factures.

## Procédure (par PJ du spool)

1. Lancer les deux extracteurs **en parallèle** (mêmes entrées, sorties
   génériques indépendantes) :

```bash
python3 /opt/data/code/doc-ocr/ocr_gemini.py <pj> > ex-gemini.json
python3 /opt/data/code/doc-ocr/ocr_openrouter.py <pj> > ex-openrouter.json
```

2. Juge général (déterministe) :

```bash
python3 /opt/data/code/doc-ocr/ocr_judge.py ex-gemini.json ex-openrouter.json
```

3. Si `doc_type == "facture"` **uniquement** :

```bash
python3 /opt/data/code/doc-ocr/invoice_adapter.py <texte-gagnant.txt> > invoice.json
python3 /opt/data/code/doc-ocr/invoice_check.py invoice.json > invoice-verdict.json
```

4. Conserver le verdict complet (winner, scores, sums_ok, audit) dans les
   métadonnées du document avant RAG (C4) — jamais de valeur réécrite.

## Limites

- Un document non taggé facture n'a **pas** de check montant (D14).
- `sums_ok: null` = non vérifiable (champs manquants / reformat invalide) —
  ce n'est pas un échec, c'est une absence.
- Clés API uniquement via l'environnement — jamais en argument.
