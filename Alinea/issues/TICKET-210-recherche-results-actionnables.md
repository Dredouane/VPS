# Ticket AREV-210 — Recherche : les résultats deviennent actionnables (ouvrir la ressource / aller à l'objet)

- **Date** : 2026-09-08
- **Référence spec** : cohérent avec §1/§2 (tout résultat doit mener à l'objet métier pertinent) — compléments des 2 modules
- **Scénarios NonReg** : (transversal) — cohérence retour sans casse
- **Persona** : Salarie_Backoffice (principal) · Gerant_PME
- **Priorité** : Moyenne
- **Type** : Amélioration UX

## Description (le contrat)
La recherche sémantique (déjà d'excellente qualité) permet de trouver la bonne info **et d'y
accéder** : chaque résultat mène, en un clic, à la ressource (fiche facture, fil email/document).

## État actuel
La recherche répond bien à une requête : on obtient 2 résultats (ex. le PDF « FACTURE N° 2026-163…
.pdf », le fil « Fwd: Facture situ MARS 26 ») avec le score. Mais les résultats ne sont **pas
cliquables** : aucun lien ni bouton « ouvrir » n'amène vers la fiche ou le fil. L'utilisateur
retrouve l'info mais ne peut pas l'exploiter dans l'interface.

## État attendu
- Chaque résultat est **cliquable/intégrable** vers le bon objet :
  - un PDF/facture → mène à la **fiche détail facture** (TKT-202) si l'objet est relié ;
  - un email/emailchain → mène au **fil de conversation** (TKT-105) ;
  - options possible : le titre du résultat est un lien + un bouton action explicite.
- Une fois ouvert, le retour fonctionne (pas de perte de contexte).

## La "douleur" du persona
Retrouver rapidement un document (recherche), le voir/agir dessus sans repartir dans un autre menu,
est un gros gain de temps pour le backoffice. Sinon la recherche (bonne fonction) reste « à moitié
débouchi » et l'utilisateur retourne à une autre navigation.

## Critères d'acceptation
- [ ] Chaque type de résultat a une action d'ouverture (fiche / fil / doc)
- [ ] Le clic mène à la bonne ressource sans erreur ; retour possible
- [ ] Cohérence : les libellés des résultats/objets respectent la vocabulaire FR (TKT-102)
- [ ] Aucune erreur JS

## Notes
S'appuie sur le lien « mailchain ↔ facture » qui sera établi (TKT-202). À faire après les objets
métier routables (fiche, fil).
