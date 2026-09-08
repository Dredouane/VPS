# Ticket AREV-201 — Module Factures : liste = file de validation normée (statuts FR, compteur, format FR)

- **Date** : 2026-09-08
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §2.1 (listes factures, statuts FR, compteurs)
- **Scénarios NonReg** : D1, D2, D3, D4, D6
- **Persona** : Salarie_Backoffice (principal) · Gerant_PME
- **Priorité** : Haute
- **Type** : Amélioration UX

## Description (le contrat)
La vue « Factures » est une **file de validation lisible** pour l'opératrice et un **registre de
pilotage** pour le gérant. Statuts en français accordés, montants bien formés, compteur utile —
plus un tableau technique brut.

## État actuel
Table à colonnes correctes (Numéro/Fournisseur/Objet/Échéance/TTC/Statut) MAIS : filtres
« valide/rejete/paye/archive » (« participe douteux, minuscules »), statut d'entrée `extracted`
(anglais) non couvert par un filtre, montants « 60226.08 EUR » (décimal point, espace d) et champ
Échéance « — ». Sous-titre technique (« …pipeline — transition de statut (D6) »).

## État attendu
- **Statuts FR normés** sur les lignes et les filtres (conformes TKT-102) : `À traiter` (c'est le
  statut d'entrée des extractions, plus jamais `extracted` affiché) · `Validée` · `Rejetée` ·
  `Payée` · `Archivée`.
- **Compteur visible** des « X à traiter » en tête (oriente l'action).
- **Chaque ligne** : N°, Fournisseur, Objet (tronqué proprement), Date, **Échéance**, **Montant
  TTC format FR** (`60 226,08 €`, virgule décimale, espace millier), Statut (badge cohérent).
- Échéance absente → libellé guide « à compléter » (et non « — » muet) qui renvoie à la fiche.
- Sous-titre en phrase orientée valeur (pas de D6/pipeline).

## La "douleur" du persona
Sans file claire, l'opératrice ne sait pas quoi valider en priorité ni parfois comment ; le gérant
ne voit pas le volume à traiter ni les montants lisiblement. Le format et le jargon tuent l'usage.

## Critères d'acceptation
- [ ] Filtres ET statuts affichés utilisent les libellés FR normés (À traiter/Validée/Rejetée/Payée/Archivée)
- [ ] Le statut d'entrée s'affiche « À traiter » (aucun `extracted`/`valide`/`rejete` visible)
- [ ] Compteur « X à traiter » visible
- [ ] Colonne Échéance : valeur OU « à compléter » (jamais « — » muet) 
- [ ] Montants au format FR; cohérence des montres sur toutes les lignes
- [ ] Sous-titre sans jargon ; aucune mention D6/pipeline
- [ ] Ouvrir une ligne → la fiche détail (TKT-202)

## Notes
Dépend de la norme de vocabulaire (TKT-102) : réaliser TKT-102 d'abord puis appliquer ici. La
cohérence « À traiter » entre dashboard (compteur) et liste est souhaitée.
