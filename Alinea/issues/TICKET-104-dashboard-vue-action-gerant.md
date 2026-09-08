# Ticket AREV-104 — Dashboard : vue « aujourd'hui » orientée action pour le gérant (hors spec Emails/Factures)

- **Date** : 2026-09-08
- **Référence spec** : cohérente avec §0, mais ajout visible de la vision produit (strat/vision_produit) — périphérie des 2 modules
- **Scénarios NonReg** : F1, F3 (cohérence) — vérifier qu'on ne casse pas la file de validation
- **Persona** : Gerant_PME (principal) · Fateh_Ug
- **Priorité** : Moyenne
- **Type** : Amélioration UX

## Description (le contrat)
Le gérant (décideur, juge en 1-2 min) voit en un coup d'œil **ce qui demande son action** et une
preuve simple de valeur — pas les logs d'exécution du système.

## État actuel
Dashboard mêlant un bon début (3 cartes KPI : Factures total / Factures à valider / Emails en
erreur) à un sous-titre technique et surtout un bloc **« Derniers runs »** (tableau Run at /
Trigger / Mails new / Docs indexés / Factures / Erreurs / Durée, lignes `run_pipeline`) inutile
pour l'utilisateur.

## État attendu
- Retirer le bloc « Derniers runs » et le sous-titre technique de la vue gérant.
- Garder/étendre les cartes en une **vue action** : ce qui demande une décision (factures à
  traiter, échéances/impayés proches, erreurs) + état rassurant quand tout est à jour.
- Optionnel : 1-2 chiffres de valeur compréhensibles (factures traitées, € de factures analysées)
  plutôt que des logs d'exécution.

## La "douleur" du persona
Le gérant se noie dans l'opérationnel technique, n'identifie pas ce qu'il doit faire ni le
bénéfice réel → il n'utilise plus le dashboard.

## Critères d'acceptation
- [ ] Aucune référence technique (runs, run_pipeline, trigger, D11…) visible sur le dashboard
- [ ] Un bloc « Actions » (à traiter / échéances / erreurs) occupe l'écran principal
- [ ] Un état positif clair quand tout est à jour (pas une page vide)
- [ ] (Bonus) chiffre « valeur » compréhensible présent

## Notes
Ce ticket n'appartient pas au cœur des 2 modules (Emails/Factures), il améliore l'entrée
décisionnelle. À affiner quand la liste de conversations et la file de validation propres
existeront (TKT-101, TKT-106).
