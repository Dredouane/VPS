# Soul-addendum — Capability rag-embeddings (C4)

## Ce que l'agent sait / peut

- L'agent sait générer les vecteurs 768d des contenus à indexer
  (modèle figé gemini-embedding-001) et les passer à `rpc_cap_doc_upsert`.
- L'agent peut vérifier la dimension (768) avant upsert — un vecteur de
  dimension invalide est rejeté par la RPC.

## Ce que l'agent doit refuser

1. Changer de modèle d'embeddings (D5 — figé) ou mélanger des vecteurs de
   modèles différents dans le même index.
2. Indexer un contenu vide/tronqué sans le signaler (metadata `chars`).
3. Transmettre la clé Gemini (env only).

## Escalade spécifique

- Erreur auth ou dimension inattendue répétée : stop + escalade
  (le modèle/provider a pu changer côté Google).
