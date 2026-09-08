# TKT-108 — Correction de valeurs d'une facture (mode edit fiche détail)

> Ticket webapp (session Alinea) — format calqué sur `../template_issue.md`,
> sans référence spec/NonReg (hors périmètre).

- **Date** : 2026-09-08
- **Persona** : Salarie_Backoffice
- **Priorité** : Haute (V2)
- **Type** : Nouvelle feature (décision architecte D-B)

## Description (le contrat)
Sur la fiche d'une facture, l'opératrice peut **corriger ou alimenter les
champs manquants** (échéance, montants, objet, fournisseur…) en mode edit
normal de la page détail — sans ressaisie totale. La correction est tracée.

## État actuel
La fiche est en lecture seule + transitions de statut (Valider/Rejeter).
Les valeurs erronées ou manquantes (ex : échéance absente) ne peuvent pas
être corrigées dans l'outil.

## État attendu
- Bouton **Modifier** sur la fiche → champs éditables (mode edit inline) →
  Enregistrer / Annuler.
- Champs éditables : `date_facture`, `date_echeance`, `montant_ht`,
  `montant_tva`, `montant_ttc`, `objet`, `fournisseur`,
  `fournisseur_identifiant`, `devise`. Non éditables : `numero`, `statut`
  (transitions dédiées), champs système.
- Chaque enregistrement trace dans `extraction` (jsonb) : horodatage, email
  de l'auteur, champ, ancienne valeur → nouvelle valeur (audit lisible).
- Le statut n'est JAMAIS modifié par l'édition (jamais `extracted` — garde
  D6 déjà en place côté API).

## Critères d'acceptation
- [ ] Modifier → edit inline → Enregistrer → valeurs persistées (refresh OK)
- [ ] Audit de correction visible (qui, quand, quoi)
- [ ] Champs éditables uniquement = liste ci-dessus (API refuse le reste)
- [ ] Aucun statut modifié par l'édition
- [ ] Format FR sur les montants édités (validation)

## Notes
Backend : `PATCH /api/v1/factures/{id}` étendu (pickFacturePatch →
pickFactureUpdate : statut OU champs métier, jamais les deux dans le même
appel). Contrat openapi régénéré (gen-all). Voir PLAN-ITER-001.md §2 (D-B).
