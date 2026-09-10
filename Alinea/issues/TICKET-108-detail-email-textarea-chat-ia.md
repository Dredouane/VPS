# Ticket AREV-108 — Detail Email : Implémenter la zone de saisie du Chat IA sur la conversation

- **Date** : 2026-09-09
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §1.2 (le chat d'assistance — fonctionnalité signature)
- **Scénarios NonReg** : C4, C5, C6, C7
- **Persona** : Salarie_Backoffice (principal) · Gerant_PME
- **Priorité** : Haute (P1)
- **Type** : Bug / Complétude feature

## Description (le contrat)
Sur la page de détail d'une conversation email (`/chains/[id]`), le chat assistant d'aide à la conversation doit permettre à l'utilisateur de **poser une question** sur l'échange.

## État actuel
Sur la page `/chains/[id]`, il n'y a **aucune zone de saisie** (`textarea` / `input`) ni aucun bouton d'envoi pour poser une question. Le champ texte est totalement absent de la vue (0 élément `input`/`textarea` présent dans le DOM de cette page).

## État attendu
- Un composant de chat IA présent sur la page de détail de conversation `/chains/[id]`.
- Un champ de saisie (`textarea` ou `input` avec placeholder "Votre question sur cette conversation...") + bouton d'envoi.
- La soumission d'une question ajoute la bulle utilisateur et génère une réponse sourcée (citan les messages/PJ de la conversation).
- L'historique du chat sur la conversation est persistant après rechargement (refresh).

## Critères d'acceptation
- [ ] Presence d'un champ de saisie texte utilisable sur `/chains/[id]`
- [ ] La soumission d'une question affiche la réponse de l'assistant avec ses sources
- [ ] Les questions/réponses restent visibles après un refresh (F5)
