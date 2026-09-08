# TKT-109 — Pipeline : clés R2 dans les metadata (transfert à la session pipeline)

> Ticket à exécuter par la **session pipeline** (HermesCapabilities), pas par
> la webapp. Transmis en mini-prompt le 2026-09-08.

- **Date** : 2026-09-08
- **Persona** : Salarie_Backoffice (bénéficiaire — via Alinea)
- **Priorité** : Moyenne
- **Type** : Intégration pipeline ⇄ webapp

## Description (le contrat)
La webapp propose « Ouvrir » sur les PJ (URL signée R2) dès que
`cap_documents.metadata.r2_key` existe. **M2.8 a livré les r2_key pour les
PJ (kind=attachment)** — à vérifier en prod et compléter pour les mails.

## État actuel (M2.8)
- ✅ PJ (kind=attachment) : `metadata.r2_key` écrit par le pipeline
- ❓ Mails (kind=email) : clé du brut `thread.json` non tracée
- ❓ Lignes historiques : docs indexés AVANT M2.8 n'ont pas de r2_key

## État attendu
1. Vérification prod : presign OK sur une PJ réelle (facture 2026-163).
2. (Optionnel) `metadata.r2_key` sur les docs kind=email (thread.json du
   mail) pour un « Voir l'email brut » complet.
3. (Optionnel) Backfill des lignes historiques si nécessaire.

## Critères d'acceptation
- [ ] Presign webapp OK sur PJ réelle (verifié par la session webapp — V0)
- [ ] (Option) r2_key sur les docs email
- [ ] Convention de clé inchangée : `<GED_EMAIL_PREFIX>/<slug>/emails/<thread_id>/<fichier>`

## Notes
Convention : WEBAPP_DATA_MAPPING.md §2.5. Non bloquant pour la webapp
(bouton disabled + mention « brut indisponible » si clé absente).
