# Ticket AREV-103 — Page racine `/` : point d'entrée propre (pas de placeholder technique)

- **Date** : 2026-09-08
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §3 (anti-exigences : pas de mention dev/pas de bouton mort)
- **Scénarios NonReg** : A2
- **Persona** : Fateh_Ug (principal) · Gerant_PME
- **Priorité** : Moyenne
- **Type** : Amélioration UX

## Description (le contrat)
Tout visiteur qui ou l'URL racine (avant connexion) doit voir une page sobre et orientée
utilisateur → aboutir à une vraie connexion. Aucun contenu de développement.

## État actuel
La racine `/` affiche un placeholder de dev : badges « P0 scaffolding », « P1 contrats », texte
« Auth, factures, emails et recherche RAG arrivent en P3/P4. L'API est contractée par
openapi/openapi.yaml, généré depuis le SQL », et un bouton **« Connexion (P4) » désactivé**.

## État attendu
- `/` ne présente AUCUN badge/milestone ni référence technique (openapi, SQL, P0-P4…).
- L'accès aboutit à une connexion fonctionnelle : soit redirection vers `/login`, soit une
  landing épurée avec un bouton **« Se connecter »** actif qui mène à `/login` (et, optionnel,
  une phrase de valeur simple pour l'utilisateur cible).

## La "douleur" du persona
Un prospect / un accompagnateur qui découvre le produit par la racine voit « un produit pas
fini », un bouton mort → il ferme. Cas de démo / découverte gâché dès la première page.

## Critères d'acceptation
- [ ] `/` sans aucun badge/texte technique (P0-P4, openapi, SQL…) ni bouton désactivé
- [ ] La racine mène (par redirection ou bouton actif) à une vraie page de connexion
- [ ] Rendu propre, nul écran d'erreur

## Notes
Écran d'entrée visible avant tout login (à soigner pour la « démo passable » devant Fateh).
