# Capability doc-ocr (C3) — OCR multi-provider + deux juges

**Type** : `mix` · **Statut** : M2.3 — code + tests verts (réseau réel à M2.6
sur vraies PJ)

Extrait le texte de toutes les pièces jointes (spool C1) avec **deux
extracteurs vision en parallèle** (Gemini Vision + OpenRouter vision), désigne
le meilleur via un **juge général déterministe**, et — uniquement pour les
factures — enchaîne un **adaptateur SLM** (reformat JSON canonique) puis un
**check montant** arithmétique (Σ lignes == HT, HT+TVA == TTC).

## Composants

| Fichier | Rôle |
|---|---|
| [manifest.yaml](manifest.yaml) | Contrat : secrets GEMINI/OPENROUTER, code ×5, skill |
| [decision.md](decision.md) | Deux juges séparés (revue 01/09) — D14 |
| [code/ocr_gemini.py](code/ocr_gemini.py) | Extracteur #1 (Gemini Vision, générique) |
| [code/ocr_openrouter.py](code/ocr_openrouter.py) | Extracteur #2 (OpenRouter vision, autre famille) |
| [code/ocr_judge.py](code/ocr_judge.py) | **Juge général** : similarité, complétude, doc_type, winner |
| [code/invoice_adapter.py](code/invoice_adapter.py) | **Bifurcation facture** : SLM Flash → JSON canonique |
| [code/invoice_check.py](code/invoice_check.py) | Normalisation (aliases, nombres FR/EN) + **check montants** |
| [schemas/invoice_extraction.json](schemas/invoice_extraction.json) | Schéma canonique facture versionné |
| [soul-addendum.md](soul-addendum.md) | Refus : inventer des valeurs, masquer un écart, check hors facture |
| [tests/test.sh](tests/test.sh) | Unitaires purs (juge, nombres, sommes, adaptateur) |

## Secrets requis (dans `HermesConfig/clients/<slug>/client.env`, 600)

| Variable | Rôle |
|---|---|
| `GEMINI_API_KEY` | Vision #1 + adaptateur Flash (valeur SUREN_GEMINI_API_KEY réutilisable) |
| `OPENROUTER_API_KEY` | Vision #2 (valeur SUREN_OPENROUTER_API_KEY) |

Env : `OCR_OPENROUTER_MODEL=openai/gpt-4o-mini`, `OCR_INVOICE_TOLERANCE=0.02`.

## Points d'architecture (D14)

- Sortie extracteurs **générique** (`{text, doc_type_hint, confidence}`) —
  aucun schéma facture imposé à la transcription.
- Juge général = code pur, **toujours** ; check montant = **bifurcation
  uniquement** si facture détectée (hints majoritaires + heuristiques).
- L'adaptateur SLM reformate mais **ne juge jamais** — sa sortie est
  re-validée par le code ; reformat invalide → `sums_ok: null`.
- `sums_ok: false` ≠ échec : écart rapporté + confiance réduite, le humain
  tranche dans la webapp (D6).

## Coûts / quotas

2 appels vision + (si facture) 1 appel Flash par PJ. Modèles low-cost
(flash/4o-mini). À surveiller en volume — quotas par client.env.

## Historique

- 2026-09-01 : création (M2.3) — design révisé en cours de grill : deux juges
  séparés (général / montants), extracteur #2 OpenRouter, adaptateur SLM
  branché sur la bifurcation facture.
