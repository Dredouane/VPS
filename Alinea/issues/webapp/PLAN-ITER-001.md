# PLAN-ITER-001 — Fusion découvertes webapp ⇄ tickets UX

> **Auteur** : session opencode webapp (Alinea). Date : 2026-09-08.
> **Statut** : validé par l'architecte (décisions D-A/D-B/D-C + LLM chat).
> Ce document FUSIONNE les découvertes techniques de la session webapp avec
> les tickets UX du dossier parent (`Alinea/issues/TICKET-*.md`). Il fixe
> l'état RÉEL du produit (ce qui existe déjà) et l'ordre d'exécution.
> Les tickets produit restent la référence du QUOI ; ce plan ajoute le
> comment, les causes racines et les dépendances pipeline.

---

## 1. État réel vérifié (avant de croire qu'il faut tout construire)

| Élément | État réel en prod (alinea-test) |
|---|---|
| Contrats API (openapi.yaml généré depuis SQL) | 26 schémas, 16 opérations — SQL ⇄ YAML ⇄ types: 1 seul fil, CI anti-dérive |
| Auth Supabase (session cookie) | Fonctionnelle — admin `REDACTED_EMAIL` (rôle admin, client arev) |
| Timeline conversation (TKT-105) | **Déjà construite** : ChainDetail composite, mails chronologiques, contenu extrait séparé, PJ listées |
| Factures (liste + détail + Valider/Rejeter) | **Déjà construits** — garde D6 : cible `extracted` interdite côté webapp |
| Recherche RAG | Fonctionnelle (embeddings miroir pipeline `gemini-embedding-001` 768d + `rpc_web_doc_search`) |
| URLs signées R2 | Prêtes — **dépendantes de `metadata.r2_key`** (pipeline M2.8 : OK pour les PJ, voir §5) |
| Design system | `packages/ui` (tokens, primitives, PageHeader/EmptyState/Skeleton) + skill `alinea-design` |
| Déploiement | 1 service Cloud Run `alinea-test`, deploy.sh (pattern surenSaas), secrets Secret Manager `alinea-*` |

## 2. Croisement découvertes ⇄ tickets (causes racines, gaps)

| Ticket | Cause racine / gap technique identifié | Fix |
|---|---|---|
| **101** crash `/chains` | `participants` = **string JSON double-encodée** par le pipeline (json.dumps passé au paramètre jsonb) → `s.join is not a function` | Webapp : `normalizeParticipants()` défensif (V0). Pipeline : passer l'array (mini-prompt §5) |
| **102** vocabulaire FR | Statuts/labels techniques dans l'UI | Mapping FR normé centralisé dans `packages/ui` (labels = affichage, backend garde les codes) |
| **103** page racine | Placeholder P0/P1 + bouton mort | Redirection `/` → `/login` (non authentifié) |
| **104** dashboard | Bloc runs technique | Retiré de la vue gérant ; runs conservés dans « Traitement » |
| **105** fil Gmail | PJ « Ouvrir » désactivé tant que `metadata.r2_key` absent (pipeline) ; avatars/masquage quotes à faire | **M2.8 a livré r2_key sur les PJ** → vérifier presign réel (V0) |
| **106** panneau synthèse | `classification`/`resume` = NULL (pipeline M3) — chain/factures liées déjà contractées | UI tolérante ; branchement pipeline = M3 (non bloquant) |
| **107** chat conversation | Socle déjà posé : embeddings miroir pipeline, `rpc_web_doc_search` | **V0** : SQL 009/010 + Gemini 2.5 Flash + isolation C7/honnêteté C6 |
| **201** file factures | Statuts CHECK SQL = codes ; montants = number | Labels FR + `Intl.NumberFormat fr-FR` + compteur « à traiter » côté UI |
| **202** fiche exhaustive | `extraction` jsonb contient l'audit (sums, judge) ; confiance 0.686 expliquée (0.98 × 0.7 dégradé — WEBAPP_DATA_MAPPING §4, révisé ×0.85 en M2.8) ; PDF = `document_id` → presign ; lien retour = `email_message_id` → chaîne | V2 |
| **203** chat expert facture | Pattern 107 réutilisable, scope facture + emails liés | V3 (après 107) |
| **204** Valider/Corriger/Rejeter | Valider/Rejeter ✓ + garde `extracted` ✓. **« Corriger » = évolution contrat** : PATCH étendu aux champs métier + audit jsonb (D-B validé) | V2 (TKT-108) |
| **210** recherche actionnable | Résolution résultat → objet : `cap_factures.document_id`/`email_message_id` → fiche ; `thread_id` → fil | V3 |

## 3. Décisions d'architecte actées (2026-09-08)

| # | Décision | Détail |
|---|---|---|
| D-A | Historique chat **persistant** en DB | `app_chat_messages` (009) + `rpc_web_doc_search` thread-scopée (010) — appliquées ciblées via runner `--file` |
| D-B | **Correction de valeurs** par la webapp | Mode edit normal sur la fiche ; champs métier écrits + audit jsonb (auteur/date/ancienne valeur) ; `statut` jamais `extracted` |
| D-C | Contexte chat V1 = **fil uniquement** | Isolation C7 stricte ; honnêteté C6 (pas d'invention) |
| D-LLM | Chat = **Gemini 2.5 Flash** (clé AI Studio, même Secret Manager que les embeddings) | Le comparatif OpenRouter/gpt-4o-mini du rapport M2.8 concerne le **pipeline d'extraction** (D19 pipeline), pas la webapp. Embeddings : Gemini figé D5 — jamais modifié |
| D-Mobile | V1 responsive ; PWA (Serwist) puis Capacitor plus tard | — |

## 4. Vagues d'exécution

| Vague | Contenu | Tickets couverts |
|---|---|---|
| **V0** (cette itération) | Fix participants · SQL 009/010 · chat conversation complet · nav « Emails »=inbox / « Traitement » · PLAN + TKT-108/109 rédigés · deploy | 107 (socle), 101 (cause racine) |
| **V1** | 101 stabilisation complète, 105 polish (avatars, masquage quotes, aperçu PJ), 106 panneau synthèse, 102 vocabulaire FR transversal, 103 racine | 101, 105, 106, 102, 103 |
| **V2** | 201 file normée FR, 202 fiche exhaustive + provenance, 204/108 actions + correction valeurs | 201, 202, 204, 108 |
| **V3** | 210 recherche actionnable, 104 dashboard action, 203 chat expert facture | 210, 104, 203 |

## 5. Dépendances pipeline (mini-prompts à transmettre à la session pipeline)

1. **`participants` array** : `cap_email_chains.participants` stocké en string JSON — passer l'array à `rpc_cap_chain_upsert` (les lignes existantes restent des strings ; la webapp est défensive).
2. **`r2_key` sur les emails** (kind=email) : M2.8 l'a livré pour les PJ — vérifier que le brut du mail (thread.json) est également tracé si on veut « voir l'email brut » complet.
3. **classification/résumé** (M3) : branchement LLM pour alimenter `cap_emails.classification/resume` — débloquera TKT-106 à 100 %.

## 6. Leçons de la session webapp (à ne pas repayer)

- `gcloud run deploy --source` miroir-ise le `.gitignore` → `.gcloudignore` explicite obligatoire (NEXT_PUBLIC_* build-time)
- GoTrue de ce projet exige `instance_id = 00000000-…-0000` sur les users créés en SQL direct
- Clés : `VPS_GEMINI_API_KEY` (bashrc, `AQ.Ab8…`) ≠ `SUREN_GEMINI_API_KEY` (hermes.env, invalide) — convention bashrc VPS_* → Secret Manager
- `NEXT_PUBLIC_*` : build-time (`.env.production`) **ET** runtime (`--set-env-vars`)
- Secrets : `sb_secret_` jamais dans git ni bundle client (vérifié par greps)
