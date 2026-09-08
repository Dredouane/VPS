# Ticket AREV-203 — Module Factures : assistant dédié expert de la fiche + données liées

- **Date** : 2026-09-08
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §2.2 (Zone C — le chat dédié à la facture)
- **Scénarios NonReg** : E7 (et C6/C7 comme principe d'honnêteté et d'isolation)
- **Persona** : Salarie_Backoffice (principal) · Gerant_PME
- **Priorité** : Moyenne
- **Type** : Nouvelle feature (fonctionnalité signature module Factures)

## Description (le contrat)
Chaque fiche facture dispose d'un **assistant contextuel** qui répond en connaissance de la fiche
VISIBLE et des **data points liés** à la facture (emails d'origine, fournisseur, projets/chantiers,
actions). C'est le trait d'union qui fait évoluer le produit vers un « expert du dossier », et le
prolongement du chat de conversation (TKT-107).

## État actuel
Aucun assistant dédié à une facture. Le produit ne relie pas encore la fiche à des données voisines
(emails, projets). L'utilisateur doit retomber sur des recherches manuelles pour toute question
interprétative.

## État attendu (définition de fini)
Un assistant (panneau/zone de question) accessible sur la fiche détail qui :
1. Comprend **la fiche affichée** (les valeurs extraites qu'on voit à l'écran) + les **data points
   liés** disponibles côté données (mailchain(s) d'origine, fournisseur, en-cours/projet, actions).
2. Répond en langage naturel à des questions interprétatives et factuelles sur LA facture et son
   dossier, en citant/référençant la source (la fiche, un email, un doc lié).
3. Avoue honnêtement quand une info n'est pas dispo (« je n'ai pas cette donnée ») plutôt que
   d'inventer (principe C6).
4. Reste **isolé au dossier courant** — ne mélange jamais une autre facture/client (C7).
Exemples de questions cibles : « Cette facture correspond à quel email ? », « À quel chantier est
liée ? », « Qui était le contact du donneur d'ordre ? », « Le montant HT semble étrange, tu peux
relire le PDF ? ».

## La "douleur" du persona (value)
C'est le prolongement de la promesse « l'IA comprend le dossier ». Pour l'opératrice : répondre aux
questions du gérant ou d'un tiers sans charger 3 outils. Pour le gérant : interroger la situation
comptable/dossier d'un coup d'œil. C'est ce qui rend une facture « expliquée », pas seulement
« saisie ».

## Critères d'acceptation
- [ ] Accès à l'assistant depuis la fiche facture (cohérent avec TKT-107 si le motif est réutilisé)
- [ ] Une question factuelle sur la fiche visible → réponse exacte et argument de la fiche
- [ ] Une question sur les données liées (email d'origine, chantier) → réponse bonnes lorsqu'elles
      existent, « pas dispo » sinon, jamais inventé
- [ ] Isolation par facture/client vérifiée (2 fiches distinctes → aucune contamination)
- [ ] Aucune erreur JS ; combo vocabulaire normé

## Notes
S'appuie sur le socle « chat sourcé » (TKT-107), le lien email↔facture (TKT-202) et, à terme, les
objets métier (projets/actions) au fur et à mesure qu'ils existent. Vision : cet assistant devient
l'expert du dossier complet quand les data points s'enrichiront.
