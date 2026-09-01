# 📧 PIPELINE_EMAIL_AREV.md — Design détaillé du pipeline email + facturation

> Implémentation M2 de l'agent AREV (`hermes-arev-pro`). Décisions : [`DECISIONS.md`](DECISIONS.md).
> Schéma global : [`README.md`](README.md). Ce doc fixe les **contrats des
> modules** et les **règles non-négociables**.

---

## 1. Vue d'ensemble

| Élément | Valeur |
|---|---|
| Boîte | `REDACTED_EMAIL` (contrôlée), filtre **destinataire contient `+AREV`** |
| Déclencheur | cron `*/10 8-19 * * *` (silencieux 20h-08h), **≤ 5 threads/run** |
| Idempotence | label Gmail `ia-traite` (posé en fin de pipeline) + `doc_status` par message_id |
| Écritures | RPC `rpc_cap_arev_*` (security definer, client hardcodé) — direct dès M2.6 |
| Observabilité | `pipeline_runs` + `hermes cron incidents` — **aucune notification** |

## 2. Contrats des modules `code/` (déterministes, stdlib Python uniquement)

> Règle : chaque module est une **fonction pure** (entrée → sortie JSON),
> testée par fixtures versionnées. `capability-attach.sh` refuse d'attacher
> si `capability-test.sh` échoue. Pas de `pip install` dans le conteneur.

### 2.1 `gmail_poll.py` — réception

| | |
|---|---|
| Entrée | env : `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_ALIAS_TAG=+AREV`, `GMAIL_LABEL_DONE=ia-traite`, `GMAIL_MAX_THREADS=5` |
| Action | refresh OAuth → `threads.list` (query `to:+AREV -label:ia-traite newer_than:90d`) → `threads.get` complet pour ≤5 threads |
| Sortie | `{ "threads": [ {"thread_id", "messages": [ {message_id, thread_id, headers{from,to,subject,date,message_id}, body_plain, attachments[{filename,mime,size,data_b64}]} ] } ], "count" }` |
| Erreurs | token expiré → exit 2 (cron incident) ; rate-limit → backoff |

### 2.2 `thread_parser.py` — le module bétonné (D3)

| | |
|---|---|
| Entrée | un thread JSON (sortie 2.1) + réponse `doc_status` (message_ids connus) |
| Traitement | pour chaque message : détection du **rôle** (`nouveau` / `reponse` / `transfert`) via headers (`In-Reply-To`, `References`) + parsing des quotes (`Le … a écrit :`, `On … wrote:`, `De :`, `--- Message d'origine ---`, `Forwarded message`) ; séparation **contenu nouveau** vs **segments cités** ; **position dans le thread** |
| Sortie | `{"mails": [ {"message_id", "thread_id", "role", "position", "from", "date", "subject", "new_content", "quoted_segments[]", "attachments[]", "rag_status": "known"|"new"} ]}` |
| Garantie | fixtures multilingues (FR/EN, transferts imbriqués, clients mobiles sans headers propres) ; toute régression = FAIL avant attach |

### 2.3 `ocr_gemini.py` — OCR de TOUTES les pièces jointes (D4)

| | |
|---|---|
| Entrée | PJ (bytes, mime, filename) + `GEMINI_API_KEY` |
| Sortie | `{ "text", "confidence", "model": "gemini-vision", "pages" }` |
| Limites | > 20 Mo ou mime non image/pdf → `skipped` + raison (dans metadata) |

### 2.4 `embed_gemini.py` — embeddings (D5)

| | |
|---|---|
| Entrée | textes à indexer + `GEMINI_API_KEY` |
| Sortie | `{ "embedding": [768 floats], "model": "text-embedding-004" }` — dimension **figée** |

### 2.5 `gmail_label.py` — idempotence

Pose `ia-traite` sur les message_ids **traités avec succès** (jamais en cas d'erreur du run — le message sera retraité au prochain tick).

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
- `cap_migrations` — tracker du runner (supabase-sql.sh).

**RPC dédiées slug arev** (`sql/arev/001_rpc.sql`, security definer, slug
hardcodé) : `rpc_cap_arev_doc_status`, `doc_upsert` (ordre positional :
kind, message_id, content, embedding, puis optionnels), `doc_search`
(borne ≤20), `email_upsert`, `facture_find`, `facture_upsert`
(non-rétrogradation des factures validées), `pipeline_log`.
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
