# Ticket AREV-106 — Détail conversation : panneau latéral de synthèse + objets métier liés

- **Date** : 2026-09-08
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §1.2 (panneau latéral de résumé)
- **Scénarios NonReg** : C3 (et C7 isolation)
- **Persona** : Salarie_Backoffice · Gerant_PME
- **Priorité** : Moyenne
- **Type** : Amélioration UX

## Description (le contrat)
À côté du fil de la conversation, un **panneau latéral** donne un résumé immédiat et relie
l'échange aux **objets métier** (factures liées, fournisseur, dossier). L'utilisateur comprend la
situation sans réouvrir chaque email, et verveilleux quitter la conversation avec un clic vers les
données.

## État actuel
Pas de panneau de synthèse de conversation : les champs de résumé sont absents ou montrés à cru
(champs « Classification / Reçu le / Date meta » à « — », pas de reliances vers des objets).

## État attendu
- Panneau/zone latérale sur le détail, affichant sans jargon : expéditeur principal, participants
  utiles (dont certains peuvent être masqués s'ils sont pièges), date de début de l'échange,
  **classification lisible** (Facture / Devis / Relance / Autre), statut FR.
- **Objets métier liés** affichés et cliquables dès qu'ils existent : ex. « Facture 2026-163 »
  → mène à la fiche détail du module Factures (couplage email↔facture établi).
- Si un objet n'est pas (encore) lié, afficher honnêtement « Aucune facture liée » (dans le sens
  utile) plutôt qu'un champ vide muet.

## La "douleur" du persona
L'utilisateur doit pouvoir dire en 5 secondes « de quoi parle ce fil et qu'est-ce qui en est
ressorti » (surtout si une facture en est issue) sans fouiller le texte. Ça ancre la confiance :
« le système a bien rattaché ma facture à ce fil ».

## Critères d'acceptation
- [ ] Un panneau de synthèse visible sur le détail conversation
- [ ] Participants utiles / date / classification / statut lisibles, sans jargon ni champ « — » muet
- [ ] Tout objet métier lié (facture…) affiché + cliquable vers le module concerné
- [ ] Absence d'objet : message FA aidant (pas un champs vide)
- [ ] Cohérence avec le vocabulaire normé (TKT-102)

## Notes
Le couplage « email ↔ facture » affiché ici prépare la fiche détail facture avec son lien retour
vers la mailchain (TKT-202). Faire attention à ce que le panneau reste sobre pour ne pas doubler
le fil.
