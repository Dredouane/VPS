# 📧 PIPELINE_EMAIL_AREV.md — Design détaillé du pipeline email + facturation

> Implémentation M2 de l'agent AREV (`hermes-arev-pro`). Décisions : [`DECISIONS.md`](DECISIONS.md).
> Schéma global : [`README.md`](README.md) · Clés & déploiement : [`DEPLOYMENT.md`](DEPLOYMENT.md). Ce doc fixe les **contrats des
> modules** et les **règles non-négociables**.

---

## 1. Vue d'ensemble

| Élément | Valeur |
|---|---|
| Boîte | `REDACTED_EMAIL` (contrôlée), filtre **destinataire contient `+AREV`** |
| Déclencheur | cron `*/10 8-19 * * *` (silencieux 20h-08h), **≤ 5 threads/run** |
| Idempotence | label Gmail `ia-traite` (posé en fin de pipeline) + `doc_status` par message_id |
| Écritures | RPC génériques `rpc_cap_*` (slug + `CLIENT_RPC_SECRET`, D8-v3) — direct dès M2.6 |
| Observabilité | `pipeline_runs` + `hermes cron incidents` — **aucune notification** |

## 2. Contrats des modules `code/` (déterministes, stdlib Python uniquement)

> Règle : chaque module est une **fonction pure** (entrée → sortie JSON),
> testée par fixtures versionnées. `capability-attach.sh` refuse d'attacher
> si `capability-test.sh` échoue. Pas de `pip install` dans le conteneur.

### 2.1 `imap_poll.py` — réception (IMAP, D13)

| | |
|---|---|
| Entrée | env : `VPS_GMAIL_RECEPTION_IMAP_ADRESS`, `VPS_GMAIL_RECEPTION_IMAP_MDP`, `GMAIL_ALIAS_TAG=+AREV`, `GMAIL_LABEL_DONE=ia-traite`, `GMAIL_MAX_THREADS=5`, `GMAIL_SPOOL_DIR`, `GMAIL_NEWER_THAN_DAYS=90` |
| Action | login SSL → **EXAMINE readonly** → `UID SEARCH X-GM-RAW` (`to:<alias> -label:ia-traite newer_than:90d`) → fetch `X-GM-THRID` → group par thread (≤5, récents d'abord) → fetch **BODY.PEEK[]** (jamais \Seen) → parsing RFC822 (`email.parser`) |
| Spool | `<spool_dir>/threads/<thread_id>/thread.json` + **fichiers PJ** (`att-<n>-<fichier-safe>`) — stdout = résumé léger `{"count", "thread_ids", "spool_dir"}` |
| Sortie thread.json | `{thread_id (X-GM-THRID), messages: [{uid, message_id (Message-ID canonique), header_from/to/subject/date, body_plain (plain préféré sinon html strip déterministe), attachments: [{filename, mime, size, path}]}]}` |
| Erreurs | auth → exit 2 ; réseau/IMAP → exit 3 ; retries backoff |

### 2.1bis `ged_save.py` — archivage R2 (GED, exigence 01/09)

| | |
|---|---|
| Quand | **immédiatement après le polling réussi** (avant marquage), pour CHAQUE thread |
| Action | upload du dossier spool (`thread.json` + PJ) vers R2 — clé `<GED_EMAIL_PREFIX>/<slug>/emails/<thread_id>/…` (slug = sous-dossier client) |
| Code | `ged-r2/code/{r2_client,ged_save}.py` (SigV4 stdlib, vecteur AWS + réel vérifiés) |
| Échec | **non bloquant** : consigné dans `pipeline_runs`, le pipeline continue |

### 2.2 `thread_parser.py` — le module bétonné (D3) + SAVE DB

| | |
|---|---|
| Entrée | un thread.json du spool (sortie 2.1) + liste optionnelle des message_ids déjà en RAG (`rpc_cap_doc_status`, fournie par l'orchestrateur) |
| Traitement | rôle (nouveau/reponse/transfert — sujet Re:/Tr:/Fwd:, headers, quotes), séparation **contenu nouveau** vs **segments cités** (FR/EN/Outlook, fixtures verrouillées), position chronologique, agrégat de chaîne (sujet normalisé, participants, bornes de dates) |
| Sortie | `{"thread_id", "chain": {subject, participants, messages_count, first/last_message_at}, "mails": [{message_id, uid, role, position, new_content, quoted_segments[], attachments, rag_status: known\|new}], "stats"}` |
| Garantie | idempotent (re-parse = même résultat), fixtures multilingues ; **`Tr:` = transfert FR**, `Re:` = réponse |

**SAVE DB (exigence 01/09 — par l'orchestrateur après le parser, via MCP supabase C5)** — RPC **génériques** avec `p_client_slug` + `p_rpc_secret` (env `CLIENT_SLUG`/`CLIENT_RPC_SECRET`, D8-v3) :
1. `rpc_cap_chain_upsert(slug, secret, thread_id, subject, participants, count, first, last)` → 1× (chaîne, idempotent)
2. `rpc_cap_email_upsert(slug, secret, message_id, thread_id, role, from, subject, date, classification, resume, status='received')` → **par mail** (chaîne complète, y compris anciens mails lazy)
3. `rpc_cap_doc_status(slug, secret, message_ids)` avant indexation → ne ré-indexer que `new`

### 2.3 `doc-ocr` — OCR multi-provider + deux juges (D14)

| | |
|---|---|
| Extracteurs | `ocr_gemini.py` (Gemini Vision) + `ocr_openrouter.py` (OpenRouter vision, famille différente) — **en parallèle**, sortie générique `{text, doc_type_hint, confidence}` |
| Juge général | code pur, toujours : similarité token-overlap, complétude, confidence ×2 → winner ; désaccord fort → `low_agreement` + confiance réduite |
| Bifurcation facture | hints majoritaires + heuristiques code → adaptateur SLM Flash (générique → JSON canonique `schemas/invoice_extraction.json`) → validation code → CHECK MONTANT : Σ lignes == HT, HT+TVA == TTC (±0,02) |
| Sortie | `{text, structured?, confidence, extractor, judge: {scores, sums_ok, detail}}` → C4 (embeddings) + C6 (facture pré-vérifiée) |

### 2.4 `embed_gemini.py` — embeddings (D5)

| | |
|---|---|
| Entrée | textes à indexer + `VPS_GEMINI_API_KEY` |
| Sortie | `{ "embedding": [768 floats], "model": "text-embedding-004" }` — dimension **figée** |

### 2.5 `imap_mark_done.py` — idempotence

Déplacement vers le label `ia-traite` (créé si absent) : `UID COPY` →
`\Deleted` → **UID EXPUNGE ciblé** (jamais d'expunge global). Skip si déjà
labelisé (X-GM-LABELS). Appelé UNIQUEMENT en fin de pipeline réussie —
en cas d'erreur, le message reste en place et sera retraité au tick suivant.

### 2.6bis Chain of Experts — capability `analysis-facturation` (M2.5)

| | |
|---|---|
| `expert-router` | décide des experts concernés (JSON strict `{experts, confidence, reason}`) — facturation si `doc_type == facture` OU classification facturation + PJ/mots-clés |
| `expert-facturation` | matching (`rpc_cap_facture_find`) + upsert (`rpc_cap_facture_upsert`, statut `extracted`, D6) — nombres **déjà vérifiés** par le check montant C3 ; numero absent = pas d'upsert (pipeline_runs) |
| Sortie | facture structurée dans `cap_factures` → webApp CRUD + autres agents |

**Clés & déploiement complet** : [`DEPLOYMENT.md`](DEPLOYMENT.md).

## 3. Skills LLM (Hermes)

| Skill | Rôle | Sortie imposée |
|---|---|---|
| `email-classify` | catégorie métier (facturation / devis / chantier / admin / autre) + résumé 1 phrase | JSON strict `{categorie, resume, flags}` |
| `expert-router` | Chain of Experts : « cet email me concerne-t-il ? » | JSON strict `{"experts": ["facturation"], "confidence", "reason"}` — vide si aucun |
| `expert-facturation` | extrait **tout le contexte facturation** de l'email + OCR de la PJ, matche et upsert | JSON strict du modèle facture (§5) |

Les skills **lisent les définitions SQL** (copiées dans `data/sql/arev/`) pour
connaître les tables/RPC disponibles — le schéma est la source de vérité (D9).

## 4. Idempotence & erreurs

1. Un message n'est **jamais indexé deux fois** : `doc_status` avant indexation
   (et dédup par contenu : unique `(client_id, kind, content_md5)` en DB —
   une PJ déjà vue ne crée pas de doublon).
2. Le label `ia-traite` n'est posé **qu'après succès complet** du mail (RAG ±
   expert). Erreur → pas de label → retraité au tick suivant (retry naturel).
3. Après **3 échecs** du même message (comptés dans `emails.status='error'`),
   il est laissé sans label et signalé dans `pipeline_runs.last_error` —
   investigation manuelle (pas de poison-queue infinie).
4. Chaque run insère une ligne `pipeline_runs` (compteurs : threads_seen,
   mails_new, mails_known, attachments_ocr, docs_indexed, factures_upserted,
   errors, duration_ms).

## 5. Modèle de données (résumé — source de vérité : `sql/`, projet unique multi-tenant)

**Tables génériques** `public.cap_*` avec colonne `client_slug` (le slug drive
tout — D7-v2/D9-v2) :

- `cap_documents` — RAG : `embedding vector(768)`, `kind`
  (`email`|`attachment`), `message_id`, `thread_id`, `thread_role`,
  `metadata jsonb` (**tags du vecteur** : `from`, `date`, `filename`, `mime`,
  `classification`, `ocr_confidence`, `pipeline_version`). Dedup :
  unique `(client_slug, kind, content_md5)`.
- `cap_emails` — état de traitement par message (classification, résumé,
  status, attempts, error).
- `cap_factures` — extraction expert : `numero`, `fournisseur`,
  `montant_ht/tva/ttc`, `date_facture/echeance`, `statut`
  (`extracted`→`valide`/`rejete`/`paye`), `confiance`, lien `email_message_id`
  + `document_id`, `extraction jsonb` (audit brut). Matching :
  unique `(client_slug, numero, fournisseur)`.
- `cap_pipeline_runs` — observabilité (1 ligne/run).
- `cap_clients` — **registry clients** (D7-ter) : slug, nom, statut, référent,
  rpc_prefix — déclarée par le runner, FK source pour toutes les tables
  (`client_slug → slug`). Gérée par le runner uniquement.
- `cap_migrations` — tracker du runner (supabase-sql.sh).

**RPC génériques** (`sql/generic/006_rpc_generic.sql`, security definer,
slug + secret par client — D8-v3) : `rpc_cap_doc_status`, `rpc_cap_doc_upsert`
(ordre positional : slug, secret, kind, message_id, content, embedding, puis
optionnels), `rpc_cap_doc_search` (borne ≤20), `rpc_cap_email_upsert`,
`rpc_cap_chain_upsert/get`, `rpc_cap_facture_find/upsert` (non-rétrogradation
des factures validées), `rpc_cap_pipeline_log`.
Les skills lisent les définitions copiées dans `data/sql/` (D9).

## 6. Non-régression (verrous)

1. Tests de contrat hérités du TEMPLATE + tests spécifiques par capability
   (`capability-test.sh all` → 0 FAIL obligatoire).
2. **Fixtures figées** pour `thread_parser` : tout changement de comportement
   passe par une mise à jour explicite des fixtures (diff visible en review).
3. `capability-attach.sh` exécute les tests avant tout apply — refuse si FAIL.
4. RPC versionnées dans git ; les migrations sont des fichiers numérotés
   append-only (`sql/arev/00N_*.sql`).

## 7. Séquencement M2

| Step | Livrable | Prérequis |
|---|---|---|
| M2.0 | `sql/arev/` appliqué sur projet **TEST** (pgvector, RPC, RLS) | accès Supabase TEST |
| M2.1 | C1 `email-gmail` : poller + labeling + helper OAuth | refresh token AREV |
| M2.2 | C2 `email-processing` : thread_parser + fixtures + classify | — |
| M2.3 | C3 `doc-ocr` + C4 `rag-embeddings` (code + fixtures) | clé Gemini |
| M2.4 | C5 `rag-supabase` finalisé (RPC testées sur TEST) | M2.0 |
| M2.5 | C6 `analysis-facturation` (router + expert + RPC facture) | M2.2-M2.4 |
| M2.6 | spawn v2.1 (pass-through env) + rsync + `capability-attach.sh arev …` + validation bout-en-bout (thread réel 3 mails + facture scannée factice → facture `extracted` visible webapp) | tous |
