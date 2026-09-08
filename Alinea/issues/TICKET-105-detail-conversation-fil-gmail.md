# Ticket AREV-105 — Détail d'une conversation : fil vertical « type Gmail » + pièces jointes

- **Date** : 2026-09-08
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §1.2 (fil Gmail)
- **Scénarios NonReg** : C1, C2, A4
- **Persona** : Salarie_Backoffice (principal) · Gerant_PME
- **Priorité** : Haute
- **Type** : Amélioration UX / refonte du détail conversation

## Description (le contrat)
Le détail d'une conversation s'affiche comme **une boîte mail familiale (Gmail)** : un fil de
messages vertical dans l'ordre chronologique, lisible et pro. L'utilisateur reconnaît le
pattern sans formation.

## État actuel
Le détail (ex. sur le fil « Fwd: Facture situ MARS 26 ») affiche le corps bruts mélangés à des
notes techniques internes (« Pas encore de résumé (classification branchée en M2.6-bis) »,
champs Classification/Reçu le/Date meta vides, « Contenu extrait » jeté en bloc). Aucune
présentation de fil Gmail.

## État attendu
- Chaque email du fil = un **bloc distinct** : expéditeur (nom + avatar/initiale), date/heure,
  corps mis en forme (sauts de ligne, pièges dans la signature masquée si possible), lecteur de
  transferts (« Fwd: » affiché comme contenu transféré).
- Les réponses s'**empilent dans l'ordre** du plus ancien au plus récent.
- **Pièces jointes** = vignettes (nom, type, taille) cliquables qui ouvrent un **aperçu** (pas un
  téléchargement d'office) ; absence d'aperçu → message aidant + téléchargement possible.
- Les **notes techniques internes** (« M2.6-bis », explications de mécanisme) sont supprimées de
  ce qui est montré à l'utilisateur.
- Un bouton/rien de cassé : l'accès se fait depuis la liste conversations (TKT-101) et le retour
  fonctionne (A4).

## La "douleur" du persona
L'opératrice de backoffice veut lire un échange comme dans sa boîte mail habituelle pour
comprendre vite ; les blocs bruts et les phrases de roadmap la déroutent et lui font perdre
confiance.

## Critères d'acceptation
- [ ] Le fil affiche les messages en blocs distincts ordonnés (Gmail-like)
- [ ] Nom + avatar + date visibles sur chaque bloc ; transferts reconnaissables
- [ ] Les pièces jointes s'ouvrent en aperçu (ou message aidant + téléchargement)
- [ ] Aucune mention M2.6-bis / LLM / mécanisme dans l'UI
- [ ] Accès depuis la liste + retour sans perte ; aucune erreur JS

## Notes
Construit après TKT-101 (liste). Versions suivantes : intégrer la classification/statuts réels
(ils font l'objet du TKT-102 vocabulaire) et le panneau latéral + le chat (TKT-106/110).
