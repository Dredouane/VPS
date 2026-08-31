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
| D7 | **Même projet Supabase** que la webapp CRUD + projet TEST séparé | Projet Supabase séparé pour l'agent |
| D8 | Accès DB = **RPC `security definer` client hardcodé**, clé publishable | Service key directe · accès tables direct |
| D9 | **Folder `sql/`** = source de vérité du schéma, consommé par les skills | SQL dispersé dans les capabilities |
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

## D7 — Supabase : même projet que la webapp + projet TEST ✅

**Décision** : les données agent (RAG, emails, factures extraites) vivent dans
**le même projet Supabase que la webapp CRUD AREV** (les experts alimentent
directement les données que la webapp consomme — zéro synchronisation), dans le
schéma dédié `cap_arev`. Les tests unitaires/intégration s'exécutent sur un
**projet Supabase TEST séparé**.

**Rejeté** : *projet séparé pour l'agent* — un projet de plus à gérer et une
sync à construire.

## D8 — Accès DB : RPC security definer, client hardcodé ✅

**Décision** : l'agent n'a **aucun accès direct aux tables** (RLS deny-all,
grants schéma révoqués). Tout passe par des RPC dans `public` nommées
`rpc_cap_arev_*`, en `security definer` avec `client_id` **hardcodé** dans la
fonction (impossible de toucher un autre client même avec la clé). La clé
utilisée est la **clé publishable (anon)** — par design exposable, car seules
les EXECUTE sont permises. **Jamais la service key.**

## D9 — Folder `sql/` : source de vérité du schéma ✅

**Décision** : tous les scripts SQL (schéma, RPC, RLS, migrations) vivent dans
`HermesCapabilities/sql/<slug>/` (`001_schema.sql`, `002_rpc.sql`,
`003_rls.sql`). Ils sont : (a) appliqués TEST puis prod, (b) **copiés dans
l'instance à l'attach** (`data/sql/`) pour que les skills connaissent les
définitions dont ils ont besoin, (c) versionnés git — le schéma est du code.

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
