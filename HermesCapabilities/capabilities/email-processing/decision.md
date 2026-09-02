# Decision — Capability email-processing (C2)

> Règle d'ordre : **NATIF > MIX > SIDECAR** (ARCHITECTURE.md §2).

## Besoin

Comprendre une mailChain : qui a écrit quoi, où se situe le mail reçu
(nouveau sujet / réponse / transfert), séparer le **contenu nouveau** de
l'**historique cité** (anti-doublon RAG), et connaître le statut RAG de
chaque mail (déjà indexé / nouveau — lazy backfill des anciens mails).
Puis **sauvegarder** chaîne + emails en DB (cap_email_chains + cap_emails).

## Options évaluées

| Option | Verdict |
|---|---|
| **Natif** : module code déterministe (`thread_parser.py`, stdlib, fixtures) | ✅ **retenu** |
| Parsing par LLM (prompt) | ❌ non déterministe, non testable, hallucinations sur les quotes |
| Sidecar service | ❌ inutile — code pur sans I/O réseau |

## Décision

**Natif** — le parsing de quotes (`Le … a écrit :`, `On … wrote:`,
`----- Message d'origine -----`, lignes `>`), la détection de rôle et
l'agrégation de chaîne sont des problèmes de **parsing** : ils doivent être
idempotents et non-régressifs (D3). Le module est **pur** : entrée =
thread.json du spool + liste optionnelle des message_ids déjà en RAG (fournie
par l'orchestrateur via `rpc_cap_doc_status`) ; sortie = structure
complète (contrat §2.2 de PIPELINE). Le **SAVE DB** (chains + emails) est
fait par l'orchestrateur via les RPC (`chain_upsert`, `email_upsert`) — le
module reste sans I/O.

La **classification métier** (`email-classify`, LLM) est une skill séparée :
elle reçoit le contenu nouveau uniquement.

## Re-vérification

| Date | Hermes | Verdict inchangé ? | Notes |
|---|---|---|---|
| 2026-09-01 | v0.20.6 | — (décision initiale) | |
