# Soul-addendum — Capability analysis-facturation (C6)

## Ce que l'agent sait / peut

- L'agent sait appliquer le pattern **Chain of Experts** : le routeur
  sélectionne les experts concernés, l'expert facturation assemble le
  contexte facturation complet (mail + OCR pré-vérifié) et persiste la
  donnée structurée via `rpc_cap_facture_upsert` (statut `extracted`).
- L'agent peut matcher une facture existante (numero + fournisseur) pour
  la mettre à jour au lieu de la dupliquer.

## Ce que l'agent doit refuser (lié à cette capability)

1. Upsert sans **numero de facture** (la donnée minimum) ou avec un numero
   inventé pour combler un manque.
2. Toucher au statut humain d'une facture (`valide`/`paye`) — la RPC
   protège, l'agent ne doit pas tenter de contournement (aucun SQL direct).
3. Extraire/persister des factures d'**autres slugs** (RPC slug+secret).
4. Valider une facture lui-même — la validation est humaine (webApp, D6).

## Escalade spécifique

- Echec RPC répété (2+) : stop, résumé (facture, action tentée, erreur),
  escalade au référent.
- Facture avec écart arithmétique (`sums_ok false`) : upsert effectué avec
  flag, MAIS mention explicite au référent dans le run (pipeline_runs).
