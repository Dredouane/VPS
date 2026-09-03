# Capability analysis-facturation (C6) — expert facturation

**Type** : `natif` · **Statut** : M2.5 — skills + RPC testées (smoke), wiring
pipeline à M2.6

**Chain of Experts** (D2) : `expert-router` détermine les experts concernés
par un email structuré ; `expert-facturation` assemble le contexte complet
(mail + facture canonique pré-vérifiée par le check montant C3) et persiste
la facture structurée dans Supabase (`rpc_cap_facture_upsert`, statut
`extracted` — D6), disponible pour la webApp CRUD et les autres agents.

## Composants

| Fichier | Rôle |
|---|---|
| [manifest.yaml](manifest.yaml) | Contrat : skills router + expert, zéro code (RPC C5) |
| [skill.md](skill.md) | `expert-router` — liste JSON stricte d'experts |
| [skill2.md](skill2.md) | `expert-facturation` — matching + upsert + règles strictes |
| [soul-addendum.md](soul-addendum.md) | Refus : pas de numero inventé, pas de statut humain touché |
| [tests/test.sh](tests/test.sh) | Contrat (les RPC sont testées dans supabase-sql.sh --smoke) |

## Données produites

`cap_factures` : numero, fournisseur (+identifiant), dates, montants HT/TVA/
TTC, statut `extracted` → validation humaine webApp (`valide`/`rejete`),
confiance, liens email_message_id + document_id, payload audit `extraction`.

## Historique

- 2026-09-01 : création (M2.5) — skills experts + wiring RPC génériques.
