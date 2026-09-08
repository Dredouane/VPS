# Ticket AREV-204 — Module Factures : actions de validation (Valider / Corriger / Rejeter) avec retour sûr

- **Date** : 2026-09-08
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §1.2 (§2.2 zone A : actions de validation) — ref EU6 partie actions
- **Scénarios NonReg** : E6 (+ E1/E2 pour la correction)
- **Persona** : Salarie_Backoffice (principal)
- **Priorité** : Haute
- **Type** : Bug + Amélioration (fiabiliser le parcours actuel)

## Description (le contrat)
Sur la fiche d'une facture « À traiter », l'opératrice peut **Valider** la donnéee extraite,
**Corriger** une valeur erronée, ou **Rejeter** la facture — avec un retour d'état clair et
persistant. Le statut passe correctement et reste le bon après refresh.

## État actuel (observé aujourd'hui)
Le bouton Valider change bien le statut (de `extracted` à `valide`), mais :
- après la validation, plus aucun pivot actionnable sur la page (« pas de transition disponible
  ici ») → il faut repasser par la liste ;
- le vocabulaire du statut reste anglais/participe (`valide`) ; pas d'action « corriger » ni
  « rejeter » claire hors du strict minimum ;
- notionalité à vérifier : la correction d'une valeur extraite n'est pas assurée.

## État attendu (conforme aux statuts FR, TKT-102)
- La fiche d'un état `À traiter` propose **Valider / Corriger / Rejeter** de façon explicite et
  non déroutante. 
- **Corriger** : permet d'éditer une valeur (ex. l'échéance, un montant re-lu en erreur) sans
  resaisie totale, puis enregistre ; l'état devient « Validée (avec correction) » ou reste à valider
  selon sémantique (à définir proprement, transparence : la correction est donc tracée).
- **Valider** → le champ passe à `Validée` ; l'utilisateur voit un retour immédiat + possibilité de
  revenir (pas de « plus rien disponible » qui force à quitter la page). Au minimum un lien/rappel
  pour revenir à la liste et le statut apparemment mis à jour.
- **Rejeter** → `Rejetée` (+ libellé qui explique, à compléter).
- Tout état choisi **persiste après refresh** (NonReg E6).
- Le libellé du statut dans les filtres et la liste reste cohérent (TKT-102/201).

## La "douleur" du persona
C'est l'action de tous les jours de l'opératrice de backoffice (file de validation). Si elle ne peut
pas corriger simplement une valeur extraite (le contrôle d'un « assistant » qui se trompe), elle
retombe dans la ressaisie manuelle ET perd confiance envers l'outil. Le produit doit rester « l'IA
propose, l'humain garde la main ».

## Critères d'acceptation
- [ ] Sur une fiche « À traiter », actions Valider / Corriger / Rejeter toutes présentes et visibles
- [ ] Valider → statut « Validée » + retour immédiat ; Rejeter → « Rejetée »
- [ ] Corriger permet d'éditer une valeur et enregistre sans re-saisie totale ; trace/état cohérent
- [ ] Après l'action, l'utilisateur a un moyen simple de revenir à la liste (pas une page « morte »)
- [ ] Le statut persiste après refresh ; cohérent avec la liste et les filtres (TKT-201)
- [ ] Aucune erreur JS ; libellés FR normés

## Notes
Complète TKT-201 (liste) : il assure le geste métier au niveau fiche. Se coordonner pour que le
back-end expose les transitions (à traiter → validée/rejetée, correction) proprement, côté UI
libellés FR.
