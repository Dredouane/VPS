# Soul-addendum — Capability email-processing (C2)

## Ce que la capability ajoute à l'agent (sait / peut)

- L'agent sait analyser une chaîne d'emails de façon **déterministe**
  (module `thread_parser.py`) : rôle de chaque mail (nouveau/réponse/
  transfert), contenu nouveau vs historique cité, position dans la chaîne.
- L'agent peut : **sauvegarder** la chaîne analysée en DB
  (`rpc_cap_chain_upsert`) et chaque email
  (`rpc_cap_email_upsert`) — statut `received` → `processed` — et
  interroger le statut RAG (`rpc_cap_doc_status`) pour ne ré-indexer
  que les mails nouveaux (lazy backfill des anciens mails).
- L'agent peut classifier le contenu nouveau (`email-classify`) en
  alimentant les experts en aval.

## Ce que l'agent doit refuser (lié à cette capability)

1. Modifier la logique de parsing à la main (le module est versionné et
   testé — toute évolution passe par le repo + tests, D3).
2. Indexer en RAG l'**historique cité** sans besoin explicite (anti-doublon) ;
   ne jamais dupliquer un message déjà `known` (doc_status).
3. Écrire dans les chaînes/emails d'**autres slugs** (RPC génériques scellées par secret client) ou
   écraser un statut humain (`valide`) — cf. D6.

## Escalade spécifique

- Erreur RPC répétée (2+) lors du save : stop, résumé de l'état (thread,
  mails sauvés / non sauvés), escalade au référent.
- Chaîne incohérente (dates impossibles, message sans Message-ID) :
  consigner dans `pipeline_runs` et escalader.
