# Ticket AREV-110 — Navigation Sidebar : Corriger le lien et la route Traitement

- **Date** : 2026-09-09
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §0 & §3
- **Scénarios NonReg** : Nav1
- **Persona** : Salarie_Backoffice · Gerant_PME · Fateh_Ug
- **Priorité** : Moyenne (P2)
- **Type** : Bug de Navigation / Routing

## Description (le contrat)
Chaque item de la navigation latérale (Sidebar) doit pointer vers sa vue propre sans doublon ni erreur 404.

## État actuel
- Dans la sidebar, l'onglet nommé `Traitement` possède un `href="/emails"`, ce qui est un doublon exact avec l'item `Emails` (qui pointe aussi vers `/emails`).
- Taper directement l'URL `/traitement` dans la barre d'adresse renvoie une page d'erreur **404 Next.js**.

## État attendu
- Soit l'item `Traitement` pointe vers une vraie vue de suivi des traitements/flux,
- Soit l'item doublon est retiré de la navigation si la vue n'existe pas.

## Critères d'acceptation
- [ ] Aucun lien de navigation ne pointe vers une route identique à un autre lien
- [ ] Aucun lien de la sidebar ne produit une erreur 404
