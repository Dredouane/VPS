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
| D18 | **Vendoring** `mail-parser-reply` v1.36 (MIT, fr/en/de/it/nl/da/ja) dans le code — séparation replies/quotes robuste multi-providers sans pip runtime | Parser maison regex · SLM parse · pip runtime (I11) |
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

## Historique

- 2026-08-31 : création du registre (D1-D12, session grill-me pipeline email
  AREV). Doc design : [`PIPELINE_EMAIL_AREV.md`](PIPELINE_EMAIL_AREV.md).
