# Ticket AREV-111 — Vocabulaire FR : Nettoyage des 4 résidus de jargon dev (TKT-102 suite)

- **Date** : 2026-09-09
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §0 & §3 (anti-exigences)
- **Scénarios NonReg** : A3
- **Persona** : Fateh_Ug · Gerant_PME · Salarie_Backoffice
- **Priorité** : Moyenne (P2)
- **Type** : Amélioration UX / Francisation

## Description (le contrat)
L'ensemble des écrans du produit doit être libellé en français métier, sans terme technique de développement.

## État actuel (4 résidus constatés)
1. **Page `/login`** : Paragraphe en bas de carte `Accès réservé — mapping dans app_users (admin / backoffice / terrain)`.
2. **Page `/recherche`** : Titre principal H1 `Recherche RAG` (`RAG` = jargon dev).
3. **Page `/chains` (Conversations)** : Sous-titre `Conversations email (threads Gmail) traitées par le pipeline — vue type inbox`.
4. **Page `/admin`** : En-tête `runner D9` + note de bas de page `Supabase / API admin`.

## État attendu
1. `/login` : Remplacer par une phrase simple type `Accès réservé aux utilisateurs autorisés.` (ou supprimer).
2. `/recherche` : Titre H1 `Recherche` ou `Recherche de documents`.
3. `/chains` : Sous-titre `Vos échanges emails et documents associés`.
4. `/admin` : Supprimer les termes `runner D9`, `Supabase`, `API admin`.

## Critères d'acceptation
- [ ] Remplacement des 4 textes ciblés par du vocabulaire métier
