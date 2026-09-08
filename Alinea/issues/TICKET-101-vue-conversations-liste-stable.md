# Ticket AREV-101 — Vue conversations (`/chains`) : réparer la stabilité ET afficher une liste de conversations

- **Date** : 2026-09-08
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §1.1 (liste des conversations / mailchains)
- **Scénarios NonReg** : B1, B2, B6 (et A5)
- **Persona** : Salarie_Backoffice (principal) · Gerant_PME
- **Priorité** : Haute
- **Type** : Bug + Amélioration UX

## Description (le contrat)
La vue « Conversations » (route `/chains`, menu "Chaînes") est LE point d'entrée du module
Emails. Elle doit être **stable** (jamais un écran d'erreur) et afficher une **liste de
mailchains**, une par console de conversation — pas une page vide ni des emails jetés.

## État actuel
- La vue est **instable** : elle oscille, d'un chargement à l'autre, entre l'écran technique
  « This page couldn't load » (exception JS) et une page vide (seul le titre, aucun contenu,
  DOM sans `<main>` exploitable). Rejoué plusieurs fois : crash intermittent reproductible.
- Même quand elle ne crashe pas, elle n'affiche rien de lisible pour un utilisateur.

## État attendu
- `/chains` charge **déterministiquement** (10 chargements sans crash ni page vide).
- La vue présente une **liste de conversations (mailchains)**, chacune avec : expéditeur(s),
  objet (tronqué proprement), aperçu utile, date/heure de réception, statut FR.
- Si aucune donnée : un **état vide propre et aidant** en français (« Aucune conversation pour
  le moment »), jamais un écran technique ni une page muette.
- Aucune erreur JS en console sur cette route ; la navigation aller-retour (liste ↔ détail)
  fonctionne sans perte ni crash.

## La "douleur" du persona
L'employée de backoffice et le gérant butent sur un écran d'erreur en anglais ou une page vide
aléatoirement. Impression de produit cassé → défiance immédiate, abandon. C'était le cœur
« quotidien » du produit, inutilisable.

## Critères d'acceptation
- [ ] `/chains` charge de façon déterministe (10 essais sans crash ni page vide)
- [ ] Une liste de conversations s'affiche avec les bons descriptifs (objet, expéditeur, date, aperçu)
- [ ] Aucune ligne n'a un champ clé vide sans explication (si vide → libellé guide)
- [ ] État vide éventuel : message FR + CTA/idée d'action
- [ ] Aucune erreur JS console ; retour liste↔détail fonctionnel
- [ ] Plus AUCUN écran d'erreur technique anglais rencontré sur ce parcours

## Notes
Fondation du module Emails : on construit la liste de conversations AVANT le détail fil
(cf. TKT-108). S'appuie sur la donnée mailchain déjà présente côté serveur (le fil « Fwd:
Facture situ MARS 26 » existe conceptuellement dans AREV).
