# 📜 DECISIONS.md — Registre des décisions HermesCapabilities

> Style ADR (comme `HermesConfig/ARCHITECTURE.md`). Décisions prises en
> session grill-me des 30-31/08/2026 pour le pipeline email AREV. Chaque
> décision indique l'alternative **rejetée** et la justification. Ne pas
> rouvrir sans nouvelle leçon documentée.

---

## Table récapitulative

| # | Décision | Alternative rejetée |
|---|---|---|
| D1 | Déclencheur = **polling cron** 10 min, heures creuses 20h→08h | Gmail Push Pub/Sub · webhook externe Cloudflare |
| D2 | **Expert = skill** dans le même agent (Chain of Experts) | Bot Hermes réel dès M2 · sidecar agent dédié |
| D3 | Thread-parser = **code déterministe bétonné** (pas de LLM) | Parsing LLM des quotes |
| D4 | OCR = **Gemini Vision** (clé SUREN réutilisée) | Tesseract local · Firecrawl API |
| D5 | Embeddings = **Gemini gemini-embedding-001, 768d, figé** | OpenAI 1536d · embeddings locaux |
| D6 | Facturation : **auto-upsert + statut `extracted`** | Propose-then-write · seuil de confiance |
| D7 | **UN projet Supabase multi-tenant** (clients, tests, prod) — tables génériques `cap_*` + colonne `client_slug`, le slug drive tout | Projet TEST séparé · schéma par slug (obsolète) |
| D8 | Accès DB = **RPC génériques** `rpc_cap_*` (slug + **`CLIENT_RPC_SECRET`** par client vérifiés dans `cap_clients`) sur tables génériques ; RLS deny-all ; clé publishable | Service key directe · accès tables direct · RPC per-slug hardcodées (v2, retirées 01/09) |
| D9 | **`sql/generic/` + `sql/<slug>/`** = source de vérité ; runner `supabase-sql.sh` + tracker `cap_migrations` | SQL dispersé · scripts tout-slug |
| D10 | **Filtre +AREV strict** — boîte multi-clients par alias | Traiter toute la boîte |
| D11 | **Silencieux** — zéro Telegram, traçabilité `pipeline_runs` | Notifications TG par email traité |
| D12 | **Rollout direct** + cadence 10 min / max 5 threads | Phase DRY_RUN · 30 min / 20 threads |
| D13 | Réception = **IMAP app password** (creds existants, OAuth Testing = refresh expiré 7j, parsing RFC822 déterministe) | OAuth Gmail API (révisée 01/09) |
| D14 | OCR = **2 extracteurs vision** (Gemini + OpenRouter) + **deux juges séparés** : général (code, toujours) / montants (bifurcation facture, code) avec adaptateur SLM Flash | Juge unique fusionné (revue 01/09) · un seul extracteur · schéma imposé à tous les docs |
| D15 | **Facture = PJ-sourced only** — la donnée structurée provient exclusivement d'une PJ facture OCR-vérifiée ; un nième forward sans PJ = RAG + chaîne seulement, jamais d'écrasement. Identification "traité ou pas" par mail (message_id, 3 niveaux : label, doc_status, facture_find) | Créer/mettre à jour des factures depuis le texte d'un mail de discussion |
| D15-bis | **Orchestrateur déterministe** `run_pipeline.py` = colonne vertébrale du pipeline ; skills LLM greffées via le prompt de routine | Chaîne orchestrée par LLM fragile |
| D16 | Confiance dégradée : **extracteur indisponible → ×0,85** vs deux extracteurs divergents → ×0,7 (distinguer "absent" de "désaccord") | ×0,7 uniforme (trop pessimiste) |
| D17 | **Forward = enveloppe ignorée** — traitement dès le mail d'après (skip cover + bloc header) ; `from` = expéditeur réel ; facture = PJ-sourced (D15) | Indexer le texte de l'enveloppe du forward |
| D18 | **Vendoring** `mail-parser-reply` v1.36 (MIT, fr/en/de/it/nl/da/ja) — séparation replies/quotes robuste multi-providers sans pip runtime | Parser maison regex · SLM parse · pip runtime (I11) |
| D19 | **Normalisation CR/LF à la source** (imap_poll.py) — le raw Gmail body `\r\n` → `\n` avant body_plain, le vendor lib reçoit propre | Verrue au niveau parser/thraed |
| D20 | **clean_body.py** — nettoyage corps email pour affichage webApp + RAG (images, cid, quotes-fold, signatures dedup, markdown strip) | Verru inline · nettoyage côté webApp |
| D21 | **Extraction multi-types** (doc_extract.py) — xlsx/docx/pptx/csv/txt via libs natives + filtre images non pertinentes (OCR < 50 chars → skip) + r2_key par basename + facture liée au document via p_document_id | Uniquement PDF/images · r2_key par compteur global · pas de lien facture→document |
| D22 | **Split des forwards** en messages individuels via mail-parser-reply — extraction from/date/subject des headers Outlook/FR | Forward = bloc monolithique |
| D23 | **Fusion de chaînes** multiples (forward sur même sujet) | Chaînes séparées par forward |
| D24 | **`GMAIL_ALIAS_TAG` requis** — pas de default `+AREV`, check `spawn-hermes-pro.sh` | Default hardcodé → cross-pollination |
| D11-ter | Headless : routines sur le **profil default** (le scheduler ne consomme que lui) — profil ops = Desktop uniquement | Routines sur profils secondaires headless (ne tirent pas) |

---

## D1 — Déclencheur : polling cron avec heures creuses ✅

**Décision** : routine cron Hermes `*/10 8-19 * * *` (aucun tick entre 20h et
8h), max **5 threads par run** (un pic d'emails s'étale, jamais de timeout).

**Rejetés** :
- *Gmail Push Pub/Sub* : latence ~s mais projet GCP à créer + watch à
  renouveler tous les 7 jours + dépendance à une infra externe — non justifié
  pour une PME (une facture n'arrive pas 10 min avant échéance).
- *Webhook externe (Cloudflare Email Routing → `hermes webhook`)* : nécessite
  d'activer la gateway API HTTP dans le conteneur (aujourd'hui headless,
  vérifié : rien n'écoute sur 8642) + parsing brut du mail côté CF — complexité
  pour un gain de latence inutile. Réévaluable si besoin temps réel (D1 bis).

**Note vérification (31/08)** : pas de support email natif Hermes (gateway/tools
vides) ; `hermes webhook` existe mais inutilisable en headless actuel.

## D2 — Expert = skill dans le même agent ✅

**Décision** : le pattern **Chain of Experts** est implémenté en M2 par un
skill **routeur** (« cet email me concerne-t-il, quels experts ? ») + des
skills **experts** (ex : `expert-facturation`), exécutés par le même agent.
Chaque expert est un **deep module** : son périmètre, ses RPC et son
soul-addendum sont encapsulés dans sa capability.

**Rejetés** :
- *Bot Hermes réel (profil isolé) dès M2* : l'orchestration multi-bots
  headless (kanban/peer) n'est pas encore validée chez nous ; coûteux à
  déboguer. Évolution naturelle en M3 quand le pattern est prouvé.
- *Sidecar agent dédié* : flotte ×2 pour un expert — overkill.

## D3 — Thread-parser : code déterministe bétonné ✅

**Décision** : la compréhension de la mailChain est un **module de code
déterministe** (`thread_parser.py`), PAS un prompt LLM. Entrée : le thread
complet (JSON Gmail). Sortie : **liste structurée de tous les mails du
thread** avec statut RAG (déjà indexés / nouveaux) — ce qui **résout les
anciens emails d'avant le service** (lazy backfill à chaque mail reçu du
thread, cf. D11 bis).

**Pourquoi** : le parsing de quotes (`Le … a écrit :`, `On … wrote:`,
`De :`, séparateurs de transfert) est un problème de parsing, pas de
compréhension — un LLM y est non déterministe et non testable. Le code est
**idempotent, testable par fixtures multilingues, non-régressif**.

**Non-négociable** : ce module et ses fixtures sont verrouillés — tout
changement passe par les tests ; `capability-attach.sh` refuse d'attacher
une capability dont les tests échouent.

## D4 — OCR : Gemini Vision ✅

**Décision** : OCR des pièces jointes via **Gemini Vision** (`SUREN_VPS_GEMINI_API_KEY`,
réutilisée — quota surveillé, clé dédiée AREV si friction). Qualité élevée sur
factures scannées et photos chantier.

**Rejetés** : *Tesseract local* (gratuit/privé mais qualité insuffisante sur
photos penchées) ; *Firecrawl* (clé à créer, pricing à qualifier).

**Note** : les documents transitent par Google — la boîte appartient à
Redouane (data controller), acceptable ; consentement client à formaliser si
la boîte devient celle du client.

## D5 — Embeddings : Gemini text-embedding-004, 768d ✅

**Décision** : modèle **figé** `text-embedding-004` (768 dimensions). Changer
de modèle = réindexer tout le RAG → le schéma SQL (`vector(768)`) et le code
sont verrouillés dessus. Même clé SUREN que l'OCR (cohérence fournisseur).

**Rejetés** : *OpenAI* (clé à créer, 1536d) ; *local Ollama* (une brique de
plus à maintenir sur le VPS).

## D6 — Facturation : auto-upsert + statut `extracted` ✅

**Décision** : l'expert écrit en **automatique** dans Supabase avec
`statut='extracted'` + payload d'extraction brut (`extraction jsonb`) et
confiance. La **validation humaine = transition de statut** dans la webapp
CRUD (`valide` / `rejete`). L'extraction de donnée n'est pas un acte
engageant (contrairement à l'envoi d'un document) — le SOUL.md principal
n'est pas violé.

**Rejetés** : *propose-then-write* (pipeline bloqué sans humain) ; *seuil de
confiance hybride* (seuil non calibré au départ — réévaluable après retours).

## D7 — Supabase : UN projet multi-tenant, le slug drive tout ✅ (révisé 31/08, D7-ter 01/09)

**Décision (révision suite décision utilisateur)** : un **seul projet
Supabase** héberge tout le projet Hermes — tous les clients, les tests ET la
prod. Le **slug de l'instance discrimine tout** : tables génériques
`public.cap_*` avec colonne `client_slug`, et le slug drive toutes les
requêtes SQL/RAG via les **RPC génériques + secret par slug**. La webapp CRUD du client
consommera ces tables (même projet, zéro synchronisation).

**D7-ter (01/09) — Registry + intégrité** : table générique
`public.cap_clients` (slug, nom, statut `active/suspended/archived`, référent,
rpc_prefix), **FK** `client_slug → cap_clients.slug` sur les 4 tables de
données, **auto-déclaration par le runner** à l'apply d'un dossier
`sql/<slug>/` (`--client-nom` / `--client-referent`). La registry est gérée
**par le runner uniquement** (RLS deny-all, aucune RPC pour l'agent). Un slug
inconnu ne peut plus créer de données.

**Décisions reportées (revue 01/09)** : la **webapp CRUD AREV sera construite
plus tard** — ses lecteurs (REST/RLS/API) seront documentés au moment de sa
conception ; la **rétention/purge** est reportée (volumes minuscules au
départ, décision réversible).

**Rejetés / obsolètes** : *projet TEST séparé* (version initiale D7 — remplacé
par smoke tests admin-side sur le même projet, lignes marquées + cleanup) ;
*schéma par client (`cap_<slug>`)* (v1 — remplacé par colonne `client_slug`) ;
*registry purement git sans SQL* (fantômes possibles).

## D8 — RPC génériques + secret par slug, RLS deny-all ✅ (v3, 01/09)

**Décision (v3 — révision suite revue utilisateur)** : les RPC per-slug
hardcodées (`rpc_cap_arev_*`, v2) créaient une duplication ×N clients
(l'agent/webapp devait cibler des noms de fonctions différents par slug).
**V3** : **une seule série de RPC génériques** `rpc_cap_*` avec signature
commune `(p_client_slug, p_rpc_secret, …)` — la garde `cap_auth_client`
valide le couple contre `cap_clients` (statut='active') et retourne le slug.
Le secret (`CLIENT_RPC_SECRET`, 24 octets hex) est **généré par le runner** à
la déclaration et écrit dans `client.env` (600). Les tables génériques restent
RLS deny-all + grants révoqués : la clé publishable seule ne suffit plus — il
faut aussi le secret du slug.

**Nettoyage** : les 9 RPC per-slug sont **droppées** (clean swap —
`arev/003_rpc_deprecate.sql`, rien en prod). La webApp utilisera **les mêmes
tables génériques** (service key) sans sauter de fonctions selon le slug.

**Évolution D8-bis (future)** : JWT par client (claim slug + RLS) si besoin
de rotation/expiration fine. Risque résiduel : secret par slug dans
`client.env` (600, hors git) — même exposition que les autres secrets du
client.

## D8-v2 (historique — remplacé par v3)

## D9 — sql/ générique + dédié, runner avec tracker ✅ (révisé 31/08)

**Décision (révision)** : `sql/generic/` = structure commune **sans slug**
(tables, indexes, RLS) ; `sql/<slug>/` = scripts **dédiés au slug** (RPC +
spécificités) — séparation demandée par l'utilisateur. Le runner
`scripts/supabase-sql.sh` applique **générique d'abord, slug ensuite**,
tracke chaque fichier dans `public.cap_migrations` (jamais double-apply,
`--force` pour réappliquer l'DDL idempotent), post-checks intégrés (tables,
RLS, RPC), smoke tests + cleanup admin.

## D7bis/D9bis (historique v1 — remplacés ci-dessus)

## D10 — Filtre +AREV strict ✅

**Décision** : `REDACTED_EMAIL` est une **boîte contrôlée** destinée au
multi-clients par alias Gmail (`+AREV`, `+CLIENT2`…). L'agent AREV ne traite
que les messages dont les destinataires contiennent `+AREV`. Chaque client
aura : son OAuth (refresh token dédié), son filtre +TAG, ses RPC génériques scellées par secret client.

## D11 — Silencieux : zéro Telegram ✅

**Décision** : aucune notification Telegram du pipeline (ni succès, ni
facture). Traçabilité = table `pipeline_runs` (compteurs, erreurs par run) +
`hermes cron incidents`. Consultation via webapp/Supabase.

**Rejeté** : notifications par email traité (bruit) — réintroducibles plus
tard pour les anomalies uniquement.

## D12 — Rollout direct + cadence ✅

**Décision** : pas de phase DRY_RUN — écritures réelles dès la mise en
service (les RPC sont validées au préalable sur le projet TEST + fixtures).
Cadence : poll toutes les 10 min (8h-19h), **max 5 threads par run**.

**Rejeté** : DRY_RUN d'abord (retarde la mise en service) ; 30 min/20 threads
(batchs gros = runs longs, timeout risk).

---

## D13 — Réception email : IMAP app password ✅ (01/09, révisé après M2.1 initial)

**Décision** : la réception passe par **IMAP app password** (creds déjà
possédés par le propriétaire de la boîte) plutôt que l'API OAuth Gmail.
Vérifié **live en read-only (01/09)** : login OK, X-GM-RAW (recherche Gmail),
X-GM-THRID (threading), X-GM-LABELS, label `ia-traite` à créer.

**Pourquoi IMAP** :
1. Creds **déjà en place** (`VPS_GMAIL_RECEPTION_IMAP_ADRESS/MDP`) — zéro setup Google Cloud.
2. ⚠️ OAuth : une app en mode *Testing* non vérifiée → **refresh token expiré
   tous les 7 jours** (politique Google) — intenable en prod sans vérification d'app.
3. Parsing **plus déterministe** : raw RFC822 → `email.parser` stdlib.
4. `imaplib` + `email` = stdlib (invariant I11).

**Garanties** : lecture EXAMINE + BODY.PEEK (zéro mutation) ; marquage =
COPY vers `[Gmail]/ia-traite` + \Deleted + **UID EXPUNGE ciblé** (jamais
d'expunge global) ; skip si déjà labelisé. **Plan B** : OAuth API (helper
`gmail-oauth-setup.sh` conservé) — à réévaluer si vérification d'app faite.

## D14 — OCR multi-provider, deux juges séparés ✅ (01/09)

**Décision (révisée après revue utilisateur)** : le module OCR extrait des
documents de TOUTES sortes — la sortie des extracteurs est **générique**
(`{text, doc_type_hint, confidence}`), pas un schéma facture imposé.

**Deux juges séparés** (la fusion initiale était une erreur de conception) :
1. **Juge général** (toujours, code pur) : similarité token-overlap entre les
   2 extractions, complétude, confidence, doc_type = **majorité hints +
   heuristiques** (mots facture/TVA/échéance + densité montants), winner ;
   désaccord fort → `low_agreement` + confiance réduite.
2. **Check montant** (bifurcation **uniquement si facture**) : adaptateur
   SLM **Gemini Flash** reformate le texte gagnant en JSON canonique
   (`schemas/invoice_extraction.json`), sortie **re-validée par le code**
   (aliases, nombres FR/EN), puis Σ lignes == HT et HT+TVA == TTC (±0,02).
   Reformat invalide = `sums_ok: null` — jamais inventé. Un document
   non-facture n'a PAS de check montant.

Extracteur #2 : **OpenRouter vision** (`SUREN_VPS_OPEN_ROUTER_API_KEY` existante)
— famille différente de Gemini = vraie diversité. Rejetés : juge unique
fusionné, schéma imposé à tous les docs, Tesseract sidecar.

## D15 — Facturation : PJ-sourced + identification par mail ✅ (run réel 01/09)

**Décision (exigence utilisateur)** : tous les emails de l'alias seront des
**forwards** ; les anciens mails peuvent avoir déjà traité la facturation.
Le mécanisme "déjà traité ou pas" = **identification par mail** (message_id),
déjà en place à **3 niveaux** : (1) poller `-label:ia-traite`, (2)
`rag_status` par message_id (`rpc_cap_doc_status`), (3) facture via
`rpc_cap_facture_find(numero, fournisseur)` + non-rétrogradation (D6).

*Nouveau* : la facture structurée ne provient **que** d'une PJ facture
(OCR canonique pré-vérifié). Sans PJ → RAG + chaîne, jamais d'écrasement.
Existant : un even $VPS_EXÉCUT… *n/a*.

*Model drift 01/09* : vision passée `gemini-2.0-flash` → **`gemini-3.6-flash`**
(2.0 retiré de l'API — 404), embeddings `text-embedding-004` →
**`gemini-embedding-001`** (768d via outputDimensionality). Leçon :
**vérifier la disponibilité des modèles à chaque déploiement de clé**.

## D18 — Vendoring mail-parser-reply ✅ (recherche 01/09)

**Décision** : la séparation replies/quotes (fragile entre Gmail FR/Outlook
FR/EN/clients mobiles) est déléguée à la lib **mail-parser-reply** v1.36
(MIT, multilingue **fr inclus** de base + en/de/it/nl/da/ja, maintenue,
pure Python), **vendorée** dans
`capabilities/email-processing/code/vendor/mailparser_reply/` — licence
conservée, version pinée, mise à jour = re-vendoring.
**Pas de pip runtime** (I11) ni Dockerfile (le vendoring est du code versionné).

**Pourquoi pas les IDs Gmail** : `X-GM-THRID` regroupe les messages de NOTRE
boîte — le fil interne d'un forward n'existe que comme texte dans le corps →
le parsing texte reste indispensable pour l'affichage webApp "gmail-like".
Plan B (M3) : flag `parse_degraded` → SLM si la lib échoue sur un provider
exotique (idée conservée).

**Limitation connue** : le dedup RAG des attachments est sur le contenu OCR
(md5 du texte) — deux runs force-attachments peuvent créer des docs
duplicates si l'OCR varie légèrement (fix file-md5 dedup prévu M3 ; le
chemin normal mails_new ne crée pas de doublons).

## D19 — CR/LF normalisation à la source ✅ (01/09, après recherche OpenRouter PDF)

**Fix** : la normalisation `\r\n` → `\n` se fait dans `imap_poll.py` à la
**source de `body_plain`** (le premier endroit où le contenu est extrait du
rfc2822). Le thread_parser et la lib vendored reçoivent du texte propre.
pas de verrue dans `split_quoted`.

## OpenRouter PDF : `file` content type (recherche 01/09)

**Architectural révision** : le `image_url` data-Type n'est PAS le bon format
pour envoyer des PDFs via OpenRouter. Le bon = **`file`** content type
(`plugins: [{"id": "file-parser", "pdf": {"engine": "cloudflare-ai"}}]` —
grati), avec 3 moteurs (cloudflare-ai free, mistral-ocr $2/1k page),
work any model. **Avec les PDF OpenRouter devient la voie fort** qui marche
pour n'importe quel LLM de vision (pas de restriction au modèle natif).

**Model choisi**: `openai/gpt-4o-mini` ($0.15/$0.60 par million) — cloudflare-ai
moteur gratuit parse les PDFs et les passe à GPT-4o-mini en entrée. Vision
image natif de GPT-4o-mini assure les PJ images.

## D20 — clean_body.py : nettoyage corps email pour affichage webApp + RAG ✅ (après TKT-109-b)

**Décision** : un module **pur déterministe** `clean_body.py` dans
`email-processing/code/` nettoie le contenu nouveau de chaque mail
**après** `split_quoted` (lib vendored D18) et **AVANT** embed + doc_upsert :

1. **R1** : `[image:…]`, `[cid:…]`, `<img>` → retirés (artéfacts HTML→plaintext)
2. **R2** : headers de réponse/transfert répliqués → `[citation masquée]` /
   `[transfert masqué]` (une ligne compact)
3. **R3** : signatures dupliquées (tél, adresse, "Cordialement") → dédoublonnées
   (la pipeline forward contient N copies de la même signature)
4. **R4** : contenu principal, listes, tableaux simples **conservés**
5. **R5** : markdown residual (bold `**`, `##`) → retiré

Sortie : texte brut (pas de HTML ni markdown), stocké dans
`cap_documents.content` → la webApp affiche le texte propre **directement**.
Le RAG est plus propre (le contenu est le texte utile, pas les
re-capitalisations répétées).

## D21 — Extraction documentaire multi-types + fix r2_key + lien facture→document ✅ (10/09)

**Problèmes** :
1. **r2_key bug** : le compteur `entry['attachments_ocr']` est global mais le spool nomme les fichiers par compteur par-message → fallback silencieux sur `thread.json` → la webapp télécharge un JSON au lieu du PDF.
2. **Types bloqués** : le filtre dur `.pdf/.png/.jpg/.jpeg/.webp` ignore xlsx/docx/pptx/csv.
3. **Pas de lien facture→document** : `rpc_cap_facture_upsert` accepte `p_document_id` mais le pipeline ne le passait pas.
4. **Images non pertinentes** : signatures, logos, artefacts indexés inutilement dans le RAG.

**Décisions** :
1. **r2_key par basename** : lookup `r2_map.get(os.path.basename(path))` au lieu du compteur → chaque attachment a sa propre clé R2.
2. **`doc_extract.py`** : module déterministe (openpyxl, python-docx, python-pptx) pour extraire le texte des fichiers Office. Les PDF/images restent gérés par les OCR vision.
3. **Réordonnancement pipeline** : doc_upsert **AVANT** facture bifurcation → capture du `doc_id` retourné par le RPC → passage à `p_document_id`.
4. **Filtre images non pertinentes** : si le texte OCR fait < 50 chars → skip embed + upsert (signature, logo, artefact). Compteur `attachments_skipped` dans les logs.
5. **Types inconnus** : log erreur dans `cap_pipeline_runs.last_error` + incrément `errors`, pas de crash.
6. **`requirements.txt`** : openpyxl, python-docx, python-pptx — installé au spinoff pour toutes les instances fleet.
7. **Migration 008** : backfill `document_id` sur les factures existantes + fix `r2_key` des attachments qui pointent vers `thread.json`.

## D22 — Split des forwards en messages individuels (10/09)

**Problème** : un forward vers l'alias `+AREV` contient 1 seul message IMAP
(dans le spool), mais le body du forward contient la chaîne complète (N
messages historiques). Résultat : `messages_count = 1`, `quoted_segments = []`,
la webapp affiche "1 message" alors que la chaîne en a 5. Le RAG indexe tout
le forward comme un seul document monolithique.

**Décision** : re-passer le contenu du forward à `mail-parser-reply` (vendored
D18) pour extraire les messages individuels de la chaîne. La lib reconnaît déjà
les séparateurs de 14 langues (Gmail, Outlook, Apple Mail).

**Détails d'implémentation** :
1. **`thread_parser.split_quoted()`** : quand un `RE_FORWARD_HEADER_BLOCK` est
   détecté, extraire le body forwardé puis le re-passer à `EmailReplyParser.read()`.
   Chaque fragment `EmailReply` = un message de la chaîne. `replies[0]` =
   message le plus récent (nouveau contenu), `replies[1..N]` = messages
   historiques (quoted segments).
2. **`thread_parser.parse_mail()`** : pour chaque fragment, extraire `from`,
   `date`, `subject` depuis le champ `headers` du fragment (contient les lignes
   `De:`, `Envoyé:`, `Objet:` ou `On ... wrote:`).
3. **`run_pipeline._process_thread()`** : créer N `cap_emails` + N
   `cap_documents` par thread (un par message), au lieu de 1 seul.
4. **`cap_email_chains.messages_count`** = nombre réel de messages dans la
   chaîne (pas 1).
5. **`cap_email_chains.participants`** = vrais expéditeurs de la chaîne
   (extraits depuis les headers des messages historiques).
6. **Fallback** : si le split échoue (body sans séparateur reconnu), logger un
   warning et garder le contenu brut comme `new_content` (pas de perte de
   données).

**Non-scope** (D23) : fusion de plusieurs forwards sur le même sujet dans une
seule chaîne.

**Tests** :
- CR RC 07/04 : 3 messages dans la chaîne → 3 `cap_emails`, 3 `cap_documents`
- Forward sans séparateur → fallback, 1 `cap_email`, contenu brut
- Forward Gmail classique (`On ... wrote:`) → split correct
- Forward Outlook (`De: / Envoyé:`) → split correct
- 48 tests existants → 0 régression

## D24 — GMAIL_ALIAS_TAG requis, pas de default (10/09)

**Problème** : `imap_poll.py` et `run_pipeline.py` avaient un default
hardcodé `+AREV` pour `GMAIL_ALIAS_TAG`. Résultat : tous les clients sans
alias explicite pollent le même inbox `+AREV` → cross-pollination (données
mélangées dans Supabase).

**Décision** : `GMAIL_ALIAS_TAG` est **requis** — pas de default. Si absent,
le pipeline plante explicitement (`RuntimeError`). Chaque client doit
définir son alias dans `client.env` (ex: `+AREV`, `+FATEH`).

**Fix** :
1. `imap_poll.py:155` : `cfg["GMAIL_ALIAS_TAG"]` (KeyError si absent)
2. `run_pipeline.py:246` : `env["GMAIL_ALIAS_TAG"]` + check explicite
3. `manifest.yaml` : commentaire "requis par client", pas de valeur
4. `spawn-hermes-pro.sh` : validation à la creation du secrets.env

**Prévention** : `spawn-hermes-pro.sh` plante si `GMAIL_ALIAS_TAG` manque
dans `client.env`.

## D23 — Fusion de chaînes multiples (forward sur même sujet) (10/09)

**Problème** : quand un client reçoit une réponse dans sa boîte et la forward
vers `+AREV`, Gmail crée un **nouveau `thread_id`** dans l'inbox +AREV (c'est
un nouveau message IMAP). Résultat : 2 chaînes séparées dans la DB pour le
même sujet, sans lien entre elles.

**Exemple** :
```
Chain 1: thread_id=1863095346079811737 | CR RC 07/04 | 1 email
Chain 2: thread_id=999888777666555444   | Re: CR RC 07/04 | 1 email
```

**Décision** : ajouter un mécanisme de détection et fusion de chaînes basé
sur le sujet normalisé, avec préservation de l'ordre chronologique.

**Risques identifiés et mitigations** :

| Risque | Impact | Mitigation |
|---|---|---|
| **Faux positif** : 2 sujets différents mais normalisés identiques (ex: "CR RC" dans 2 projets) | Fusion erronée de 2 chaînes distinctes | Clé de fusion = `(subject_normalized, client_slug)` — 2 chaînes ne fusionnent que si elles ont le même sujet ET le même client. Ajouter un seuil de similarité (Levenshtein ≤ 2) pour les sujets quasi-identiques. |
| **Ordre chronologique** : les dates des messages historiques peuvent être mélangées | Affichage désordonné dans la webapp | Trier les `cap_emails` par `date_iso` chronologique après fusion, pas par ordre d'arrivée. |
| **Doublons** : un même message peut apparaître dans 2 forwards (le client forward le même mail 2 fois) | Documents et embeddings en double | Dédup par `content_md5` (existe déjà) + dédup par `message_id` si présent dans les headers. |
| **Participants** : les participants des 2 forwards peuvent chevaucher | Liste de participants doublonnée | Dédupliquer `participants` après fusion (set union). |
| **Factures** : une facture peut être dans le 1er ou 2ème forward | Double extraction de facture | `facture_upsert` est idempotent par `content_md5` — pas de doublon. Vérifier que `p_email_message_id` pointe vers le bon message. |
| **R2** : les attachments du 2ème forward ont des clés R2 différentes | Pas de collision (clés basées sur basename) | Pas de risque — chaque forward a ses propres clés. |
| **Migration** : les chaînes existantes dans la DB ne sont pas fusionnées | Pas de régression immédiate | La fusion ne s'applique qu'aux nouveaux forwards. Pas de migration nécessaire (ou backfill optionnel). |
| **Idempotence** : re-forward du même mail ne doit pas créer de doublon | Chaîne fusionnée en double | Le pipeline est déjà idempotent (content_md5). La fusion vérifie si le `thread_id` cible existe déjà avant de merger. |

**Algorithme de détection** :
1. Quand un nouveau thread est traité, extraire `subject_normalized` (sans
   Re:/Fwd:/Tr:).
2. Chercher dans `cap_email_chains` un thread existant avec le même
   `subject_normalized` ET le même `client_slug`.
3. Si trouvé : fusionner les `cap_emails` du nouveau thread dans le thread
   existant, trier par `date_iso`, mettre à jour `messages_count` et
   `participants`.
4. Si non trouvé : créer une nouvelle chaîne (comportement actuel).
5. Si plusieurs correspondances : ne fusionner avec aucune (ambiguïté) + logger
   un warning.

**Algorithme de fusion** :
1. `cap_emails` du thread source → `UPDATE thread_id = thread_cible` (si
   `message_id` pas déjà présent dans le thread cible).
2. `cap_documents` liés aux emails transférés → `UPDATE thread_id = thread_cible`.
3. Recalculer `messages_count`, `participants`, `first_message_at`,
   `last_message_at` sur le thread cible.
4. Supprimer le thread source (vidange) s'il n'a plus aucun email lié.

**Non-scope** : détection automatique de chaînes hors inbox +AREV (ex: chaînes
dans la boîte perso du client).

## Historique

- 2026-08-31 : création du registre (D1-D12, session grill-me pipeline email
  AREV). Doc design : [`PIPELINE_EMAIL_AREV.md`](PIPELINE_EMAIL_AREV.md).
