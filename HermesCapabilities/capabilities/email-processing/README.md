# Capability email-processing (C2) — thread parser + classification

**Type** : `natif` · **Statut** : M2.2 — parser + tests verts, save DB via RPC
(appliqué + smoke OK), classify skill affinée à M2.5

Le module bétonné (D3) : une mailChain (thread.json du spool C1) → liste
structurée de mails — rôle (nouveau/réponse/transfert), contenu nouveau vs
cité, position, agrégat de chaîne, statut RAG (lazy backfill des anciens).
Puis le **SAVE DB** : `cap_email_chains` + `cap_emails` via RPC (exigence
utilisateur 01/09).

## Composants

| Fichier | Rôle |
|---|---|
| [manifest.yaml](manifest.yaml) | Contrat (code `thread_parser`, skill `email-classify`) |
| [decision.md](decision.md) | Natif — parsing = code déterministe, jamais LLM |
| [code/thread_parser.py](code/thread_parser.py) | Le module bétonné (pur, fixtures verrouillées) |
| [skill.md](skill.md) | Skill `email-classify` (classification LLM du contenu nouveau) |
| [soul-addendum.md](soul-addendum.md) | Clauses : pas de parsing manuel, pas de doublons RAG, pas d'autres slugs |
| [tests/test.sh](tests/test.sh) | Unitaires (roles, quotes FR/EN/Outlook, idempotence, rag_status) |

## Contrat de sortie (PIPELINE §2.2)

```json
{"thread_id", "chain": {subject, participants, messages_count, first/last_message_at},
 "mails": [{message_id, uid, role, position, new_content, quoted_segments[],
            attachments, rag_status: "known"|"new"}],
 "stats": {total, new, known, roles}}
```

**Save DB (orchestrateur)** : `rpc_cap_arev_chain_upsert(...)` (1×) +
`rpc_cap_arev_email_upsert(...)` (par mail) — statut `received`, puis
`processed` après RAG/experts. Déjà appliqué + smoke OK (01/09).

## Historique

- 2026-09-01 : création (M2.2) — parser + fixtures FR/EN/Outlook + save DB
  (`cap_email_chains` générique + RPC arev, exigence utilisateur).
