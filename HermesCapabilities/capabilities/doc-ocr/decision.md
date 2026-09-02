# Decision — Capability doc-ocr (C3)

> Règle d'ordre : **NATIF > MIX > SIDECAR** (ARCHITECTURE.md §2).
> Révisions 01/09 : deux juges séparés (revue utilisateur) + extracteur #2.

## Besoin

Extraire le texte de TOUTES les pièces jointes (factures, plans, PV, photos,
courriers — pas que des factures), fiabiliser l'extraction en comparant deux
fournisseurs, et vérifier l'arithmétique des factures (Σ lignes == HT,
HT+TVA == TTC) sans jamais inventer de valeur.

## Options évaluées

| Option | Verdict |
|---|---|
| **Mix** : 2 extracteurs vision (Gemini + OpenRouter — familles différentes) + **2 juges séparés** (général code / montants code sur bifurcation) + adaptateur SLM Flash (branche facture) | ✅ **retenu** |
| Un seul extracteur | ❌ pas de fiabilisation croisée |
| Deux appels Gemini | ❌ même famille = diversité insuffisante |
| Juge unique fusionnant qualité + montants | ❌ mélange des responsabilités (revue utilisateur 01/09) |
| Schéma facture imposé à tous les documents | ❌ l'extraction est générique ; le schéma n'intervient QUE sur la bifurcation facture |
| Tesseract sidecar | ❌ qualité faible sur photos, conteneur de plus |

## Décision

**MIX** — architecture en deux juges (D14) :

1. **Juge général** (toujours, code pur) : similarité token-overlap entre
   les 2 transcriptions, complétude, confidence ×2, doc_type (hints
   extracteurs majoritaires + heuristiques mots/montants), winner.
   Désaccord fort → `low_agreement` + confiance réduite (jamais bloquant).
2. **Bifurcation facture** (si doc_type == facture) :
   adaptateur **Gemini Flash** — texte gagnant → JSON facture canonique
   (`schemas/invoice_extraction.json`) — puis **check montant** (code pur) :
   Σ lignes == HT, HT+TVA == TTC (±0,02). Reformat invalide = `sums_ok null`
   (pas de check, pas d'invention). Résultat annoté pour l'expert C6.

Clés existantes réutilisées : `GEMINI_API_KEY` (vision #1 + adaptateur) et
`OPENROUTER_API_KEY` (vision #2, famille différente) — déjà présentes dans
les secrets du VPS. Plan B extracteur : Tesseract sidecar (qualité/complexité
— écarté sauf besoin confidentialité renforcée).

## Re-vérification

| Date | Hermes | Verdict inchangé ? | Notes |
|---|---|---|---|
| 2026-09-01 | v0.20.6 | — (décision initiale) | design deux juges + bifurcation |
