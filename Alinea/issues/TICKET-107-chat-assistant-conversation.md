# Ticket AREV-107 — Module Emails : assistant « poser une question » (chat sourcé) sur une conversation

- **Date** : 2026-09-08
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §1.2 (le chat d'assistance — fonctionnalité signature)
- **Scénarios NonReg** : C4, C5, C6, C7
- **Persona** : Salarie_Backoffice (principal) · Gerant_PME
- **Priorité** : Moyenne
- **Type** : Nouvelle feature

## Description (le contrat)
Chaque conversation dispose d'un **assistant contextuel** (popup/panneau) qui aide l'utilisateur à
comprendre l'échange et à agir, répond aux questions **sur ce fil**, en citant ses sources. C'est
un des différenciateurs produit.

## État actuel
Aucune capacité de questionnement sur un fil : le reste du front ne propose ni résumé utile ni
réponse à poser question (les mentions « M2.6-bis » pointent vers un résumé non branché, /chains
casse). Rien d'actionnable côté conversation.

## État attendu (définition de fini)
Le panneau assistant, ouvrable depuis le détail d'une conversation, propose :
1. **Un résumé de la situation** en 1-3 lignes lisibles (ex. « AR confirmé, une facture jointe
   attend validation » + statut de cette conversation).
2. **Une proposition de réponse pré-rédigée** (ton sobre de la PME) prête à être copiée/adaptée.
3. **Un champ « Poser une question »** : l'agent répond avec le contenu DU fil courant, en citant
   les emails qui étayent la réponse (trace).
Contrainte comportementale :
- Question dont la réponse est dans le fil → réponse correcte, référencée (C5).
- Question HORS contenu du fil → l'agent répond honnêtement n'avoir pas l'info, sans inventer (C6).
- **Isolation stricte** au fil courant : jamais de réponse venant d'une autre conversation/client (C7).

## La "douleur" du persona (value)
L'opératrice et le gérant ne veulent pas relire des échanges bruts pour retrouver une info ou
savoir quoi répondre. Un assistant qui résume + répond + propose répond à la promesse centrale
« l'IA lit, classe et rend compte » et positionne l'humain en superviseur.

## Critères d'acceptation
- [ ] Accès à l'assistant depuis le détail (bouton/onglet clair) / recouvrir sur le fil sans casser
- [ ] Résumé utile (1-3 lignes) + proposition de réponse présentées
- [ ] Champ de question fonctionnel ; la réponse cite les emails sources quand c'est dans le fil
- [ ] Hors-contenu → réponse honnête « je n'ai pas l'info » (pas de hallucination)
- [ ] Isolation : test avec 2 conversations distinctes → jamais de contamination
- [ ] Aucune erreur JS ; compatible panneau latéral (TKT-106) et vocabulaire (TKT-102)

## Notes
S'appuie sur le backend RAG conversationnel/QA ; vérifier qu'il est isolé par mailchain (cf.
REFERENCE C7). Ce ticket pose le pattern « chat sourcé » réutilisé ensuite pour la facture
(TKT-203).
