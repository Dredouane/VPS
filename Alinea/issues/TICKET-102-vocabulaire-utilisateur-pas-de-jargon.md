# Ticket AREV-102 — Vocabulaire utilisateur : supprimer tout jargon technique de l'interface

- **Date** : 2026-09-08
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §0 (principe) + §3 (anti-exigences)
- **Scénarios NonReg** : A3 (balayage terme au travers de toutes les vues)
- **Persona** : Fateh_Ug · Gerant_PME · Salarie_Backoffice
- **Priorité** : Haute
- **Type** : Amélioration UX

## Description (le contrat)
L'ensemble du produit se lit en français métier. Le vocabulaire interne au développeur (statuts
en anglais, mentions d'éxécution, milestones, noms techniques) disparaît de TOUTES les vues
utilisateurs.

## État actuel
Exposé sur de multiples écrans : statuts en anglais (`extracted`, `received`, `processed`,
`error`, `run_pipeline`, `active`), sous-titres techniques (« Pipeline email → facturation
(silencieux, consultation D11) », « Extractions du pipeline — validation humaine par transition
de statut (D6) », « Registre de traitement du pipeline (statuts, retries, erreurs) », « Recherche
sémantique … documents indexés … OCR », « Registry clients (runner D9, lecture) »), références de
roadmap (« P3/P4 », « M2.6-bis », « classification branchée en M2.6-bis »).

## État attendu
- Statuts et filtres **français, accordés, explicites** et **identiques d'un écran à l'autre**
  (cf. liste normée contractuelle § état attendu plus bas).
- Retirés / reformulés : toute mention pipeline, run/runs, runner, retries, D6/D9/D11, P0-P4, Mx,
  registry, OCR, openapi, Supabase, « transition de statut », « silencieux ».
- Les sous-titres deviennent des phrases orientées valeur (ex. « Factures extraites
  automatiquement, à valider ») — jamais une explication du mécanisme informatique.
- **Liste normée des statuts** (à suivre partout) :
  - Factures : `À traiter` (état d'entrée, ex `extracted`) · `Validée` · `Rejetée` · `Payée` · `Archivée`
  - Conversations/Emails : `Non lu` · `À traiter` · `Traitée` (une erreur = `En erreur` + visible ⚠)
  - Ces libellés sont des AFFICHAGES ; le backend peut conserver ses codessous-jacents.

## La "douleur" du persona
Des mots incompréhensibles = produit « pas fini » dans la tête du gérant, de l'opératrice et de
l'accompagnateur. Fateh ne peut pas montrer un écran qui « parle code ». Le jargon tue la
confiance et l'adoption.

## Critères d'acceptation
- [ ] Balayage de TOUTES les vues : zéro occurrence des termes listés ci-dessus
- [ ] Chaque statut affiché utilise un libellé FR de la liste normée (accordé, explicite)
- [ ] Un libellé donné (ex. « À traiter ») est cohérent quelle que soit la vue
- [ ] Aucun fichier d'interface ne présente une phrase qui explique un mécanisme technique à l'utilisateur

## Notes
A distinguer des tickets-module (statuts dans la liste Factures = TKT-106). Faire un balayage
composant après changement pour vérifier A3 du REFERENCE.
