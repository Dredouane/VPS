# Ticket AREV-109 — Detail Email : Refonte de la disposition des composants (Layout & Rendu)

- **Date** : 2026-09-09
- **Référence spec** : `SPEC_Produit_Emails_Factures.md` §1.2 (la vision "Gmail augmenté")
- **Scénarios NonReg** : C1, C2, C3
- **Persona** : Salarie_Backoffice (principal) · Gerant_PME · Fateh_Ug
- **Priorité** : Haute (P1)
- **Type** : Refonte UX/UI / Qualité d'affichage

## Description (le contrat)
La page détail d'une conversation email (`/chains/[id]`) doit offrir une expérience de lecture fluide, sobre et professionnelle type "Gmail augmenté", et non un affichage brut de données de base de données.

## État actuel
1. **Cartes latérales redondantes** : La colonne de droite affiche deux cartes qui se répètent ("En résumé" ré-affiche `Factures liées: 2026-163`, suivi de la carte "Factures liées (1)" qui ré-affiche exactement la même facture).
2. **En-tête sans structure** : Les adresses emails des participants sont affichées sous forme de texte brut non structuré (`REDACTED_EMAIL, REDACTED_EMAIL Dernier : 06/09/2026`).
3. **Corps de mail non nettoyé** :
   - Présence de balises brutes d'images alt (`[image: Titre : Mobile - Description : mobile-icon]`).
   - En-têtes de transfert Outlook affichés en texte brut au milieu du corps (`*De :* MAHMOOD MOHSAN`, `*Envoyé :* lundi 30 mars...`).
   - Signatures d'emails dupliquées et non repliées.
4. **Vignette Pièce Jointe** : Noyée à l'intérieur du corps de mail au lieu d'être mise en valeur dans un composant/section d'attachement dédié.

## État attendu
- **Layout épuré** : Un fil principal clair à gauche (ou centré) et un panneau latéral synthétique à droite sans doublon.
- **Masquage / Repliement** : Replier par défaut les citations de transferts ("De:", "Envoyé:") et les signatures répétitives.
- **Nettoyage du texte** : Supprimer les rendus bruts de balises d'images cassées (`[image: Titre...]`).
- **Composant Pièce Jointe** : Mettre en valeur la vignette PJ (nom, type PDF, taille, bouton Ouvrir) dans une zone dédiée de l'email.

## Critères d'acceptation
- [ ] Suppression des doublons de cartes dans le panneau latéral
- [ ] Repliement / nettoyage des signatures et des en-têtes de transfert bruts
- [ ] Mise en valeur propre de la vignette de pièce jointe PDF
