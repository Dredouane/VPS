# TEMPLATE D'ISSUE — Reviewer ICP SaaS (aligné spec)

> Format standard pour un ticket exploitable par l'agent de code (opencode).
> Copier ce fichier → nommer `TICKET-XXX-titre-court.md` → remplir.
> Un seul problème / une seule demande par ticket (petits, précis, actionnables).
> Chaque ticket référence la brique de la SPEC à laquelle il se rattache
> (`spec/SPEC_Produit_Emails_Factures.md`) et les scénarios NonReg à vérifier
> (`NonReg/REFERENCE_Scenarios_Spec_Emails_Factures.md`).

---

## Ticket AREV-XXX — <Titre court et actionnable>

- **Date** :
- **Référence spec** : section(s) de `SPEC_Produit_Emails_Factures.md` concernée(s)
- **Scénarios NonReg** : codes (ex. C4, E5…) de `REFERENCE` à passer pour valider
- **Persona** : Fateh_Ug / Gerant_PME / Salarie_Backoffice
- **Priorité** : Haute / Moyenne / Basse
- **Type** : Bug / Amélioration UX / Nouvelle feature / Non-régression

## Description (le contrat)
Ce que doit produire cette itération, en 1-3 phrases orientées utilisateur final.

## État actuel (ce que fait le produit aujourd'hui)
Ce qui se passe à l'écran aujourd'hui, factuellement, opposé à la cible.

## État attendu (définition de fini)
Le comportement souhaité, conforme à la spec — aussi concret que possible.

## La "douleur" du persona (pourquoi c'est important)
Ce que ça coûte à l'utilisateur si on ne fait pas ce ticket (temps, erreur, défiance).

## Critères d'acceptation (checklist de validation — DOIT être vérifiable)
- [ ] ...
- [ ] ...

## Notes (si utiles)
Éléments de design/cohérence, données à afficher, éventuelles implications pour d'autres vues.
NE PAS mentionner d'implémentation technique imposée : on spécifie, l'agent de code décide du comment.

---
