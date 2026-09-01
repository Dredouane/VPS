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
| D5 | Embeddings = **Gemini text-embedding-004, 768d, figé** | OpenAI 1536d · embeddings locaux |
| D6 | Facturation : **auto-upsert + statut `extracted`** | Propose-then-write · seuil de confiance |
| D7 | **UN projet Supabase multi-tenant** (clients, tests, prod) — tables génériques `cap_*` + colonne `client_slug`, le slug drive tout | Projet TEST séparé · schéma par slug (obsolète) |
| D8 | Accès DB = **RPC dédiées par slug** (`rpc_cap_<slug>_*`, slug hardcodé) sur tables génériques ; RLS deny-all ; clé publishable | Service key directe · accès tables direct |
| D9 | **`sql/generic/` + `sql/<slug>/`** = source de vérité ; runner `supabase-sql.sh` + tracker `cap_migrations` | SQL dispersé · scripts tout-slug |
| D10 | **Filtre +AREV strict** — boîte multi-clients par alias | Traiter toute la boîte |
| D11 | **Silencieux** — zéro Telegram, traçabilité `pipeline_runs` | Notifications TG par email traité |
| D12 | **Rollout direct** + cadence 10 min / max 5 threads | Phase DRY_RUN · 30 min / 20 threads |

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

**Décision** : OCR des pièces jointes via **Gemini Vision** (`SUREN_GEMINI_API_KEY`,
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

## D7 — Supabase : UN projet multi-tenant, le slug drive tout ✅ (révisé 31/08)

**Décision (révision suite décision utilisateur)** : un **seul projet
Supabase** héberge tout le projet Hermes — tous les clients, les tests ET la
prod. Le **slug de l'instance discrimine tout** : tables génériques
`public.cap_*` avec colonne `client_slug`, et le slug drive toutes les
requêtes SQL/RAG via les **RPC dédiées par slug**. La webapp CRUD du client
consomme les mêmes tables (même projet, zéro synchronisation).

**Rejetés / obsolètes** : *projet TEST séparé* (version initiale D7 — remplacée
par smoke tests admin-side sur le même projet, lignes marquées + cleanup) ;
*schéma par client (`cap_<slug>`)* (v1 — remplacé par colonne `client_slug`).

## D8 — RPC dédiées par slug, RLS deny-all, clé publishable ✅ (révisé 31/08)

**Décision** : chaque slug a ses **RPC dédiées** `rpc_cap_<slug>_*` en
`security definer` (search_path figé, slug **hardcodé** dans la fonction —
l'agent arev ne peut toucher QUE ses lignes). Les tables génériques sont en
**RLS deny-all + grants révoqués** : la clé publishable (anon) ne peut que
EXÉCUTER les RPC.

**Risque résiduel documenté** : une clé publishable unique pour le projet →
un agent compromis pourrait appeler les RPC d'un autre slug. Mitigations :
clés jamais publiques (agents sur notre VPS, secrets 600 hors git) ;
**évolution D8-bis** si multi-clients réels : JWT par client avec claim slug +
policies RLS sur `client_slug = claim`. Accepté pour M2 (un seul client réel).

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
aura : son OAuth (refresh token dédié), son filtre +TAG, ses RPC hardcodées.

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

## Historique

- 2026-08-31 : création du registre (D1-D12, session grill-me pipeline email
  AREV). Doc design : [`PIPELINE_EMAIL_AREV.md`](PIPELINE_EMAIL_AREV.md).
