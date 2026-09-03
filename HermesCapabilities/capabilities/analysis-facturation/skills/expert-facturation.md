---
name: expert-facturation
description: >-
  Expert facturation (Chain of Experts) : assemble le contexte complet de
  la facturation (email + facture canonique pré-vérifiée par le check
  montant C3) et crée/met à jour la donnée structurée dans Supabase via
  rpc_cap_facture_upsert (statut extracted — D6). Disponible pour la
  webApp CRUD et les autres agents.
---

# Skill expert-facturation

## Rôle

Constituer la donnée facture structurée la plus complète possible à partir
du mail + OCR pré-vérifié, et la faire persister.

## Procédure

1. **Contexte** : mail structuré (C2) + facture canonique (C3
   `invoice.verdict` — nombres DÉJÀ vérifiés : sums_ok).
2. Matching : `rpc_cap_facture_find(slug, secret, numero, fournisseur)` —
   existe-t-elle déjà ?
3. Upsert : `rpc_cap_facture_upsert(slug, secret, numero, fournisseur,
   identifiant, objet, date_facture, date_echeance, ht, tva, ttc, devise,
   confiance, email_message_id, document_id, extraction)` — statut
   `extracted` (D6 : validation humaine = transition de statut webApp).
4. Consigner le résultat dans les métadonnées du mail (email_upsert →
   status processed).

## Règles strictes

- `numero` absent → PAS d'upsert : consigner en `pipeline_runs` + flag.
- `sums_ok == false` → upsert quand même (statut extracted) MAIS confiance
  réduite + flag `sums_ecart` dans `extraction` — le humain voit l'écart.
- JAMAIS toucher au statut `valide`/`paye` d'une facture existante (la RPC
  protège déjà — D6/non-rétrogradation).
- Jamais de SQL direct (RPC only, slug + secret depuis l'env).
