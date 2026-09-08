# Ticket AREV-202 — Module Factures : fiche détail exhaustive (toutes les valeurs extraites + lien mailchain de provenance)

- **Date** : 2026-09-08
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §2.2 (fiche détail Factures, zones A+B)
- **Scénarios NonReg** : E1, E2, E4, E5 (et D5 ouverture)
- **Persona** : Salarie_Backoffice (principal) · Gerant_PME
- **Priorité** : Haute
- **Type** : Amélioration UX / complétude de la fiche

## Description (le contrat)
La page détail d'une facture est le **poste de travail** de l'opératrice de backoffice : elle y voit
TOUTES les valeurs extraites (pour valider/corriger), la **confiance expliquée**, le document PDF
source, et la **mailchain d'origine** en un lien — pour vérifier et faire confiance.

## État actuel
La fiche montre déjà quelques champs (Fournisseur, Identifiant fourn., Objet, Date, HT/TVA/TTC,
« Confiance extraction 69 % », email source brut). Manquent des complétions selon la spec : email
source illisible, TVA « 0.00 », pas de « à compléter » (échéance absente), pas d'aperçu PDF direct
ni de lien explicite et compréhensible vers la mailchain source.

## État attendu
- **Zone A — données exhaustives**, proprement présentées : N°, Fournisseur + SIRET, Objet, dates
  (facture ET **échéance**), Destinataire / donneur d'ordre, HT / TVA (montant + taux) / TTC au
  format FR, n° client si présent. Émoji d'attention sur les champs manquants/douteux → « à
  compléter » + moyen de corriger sur place.
- **Confiance présentée et EXPLIQUÉE** (« 69 % — à vérifier : échéance absente ») jamais un % nu.
- **PDF source ouvrable en aperçu** depuis la fiche (vignette/PDF).
- **Zone B — provenance / lien mailchain** (fondamentale, soignée) : un bloc explicite qui montre la
  chaîne `email reçu (date) → pièce jointe lue → données extraites`, avec un lien cliquable vers la
  conversation d'origine (le fil Gmail TKT-105). L'opératrice doit pouvoir vérifier que l'extraction
  vient du bon email et que le lien est correct.

## La "douleur" du persona
Sans voir toutes les valeurs et la preuve de provenance, l'opératrice ne peut pas valider en
confiance → soit elle re-vérifie à l'aveugle (perte de temps), soit elle valide à tort (risque
comptable). Le lien email↔facture est ce qui bâtit la confiance dans l'extraction automatique.

## Critères d'acceptation
- [ ] Toutes les valeurs listées en « État attendu » sont affichées (celles présentes) sans forme
      vide muette : les champs absents/douteux sont signalés « à compléter »
- [ ] Le montant est au format FR ; pas de « 0.00 »
- [ ] La confiance comporte une phrase d'explication des doutes
- [ ] PDF source ouvrable (aperçu) au moins s'il est présent chez AREV
- [ ] Bloc de provenance visible + lien cliquable vers la conversation d'origine (aller-retour fonctionne)
- [ ] Aucune mention technique (D6/extracted/…) ; vocabulaire normé (TKT-102)

## Notes
Deux aspects forts : l'exhaustivité des champs (pour validation) et le lien paternel vers le fil
(confiance). S'appuie sur TKT-105 (fil Gmail) pour le lien retour. N'implémente PAS encore le chat
(c'est TKT-203) mais prévoit la place d'une zone de question.
