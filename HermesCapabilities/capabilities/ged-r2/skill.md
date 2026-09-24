---
name: ged-archive
description: >-
  Archivage R2 des fichiers bruts email : lance ged_save.py sur le dossier
  thread du spool après l'extraction (slug = sous-dossier client). Copie de
  référence des documents bruts — à exécuter systématiquement en fin de
  polling réussi.
---

# Skill ged-archive

## Rôle

Archiver les fichiers bruts de chaque email traité vers la GED R2
(clé `<prefix>/<slug>/emails/<thread_id>/…`) — copie de référence avant RAG.

## Procédure

1. Après le poll réussi (imap_poll) et AVANT le marquage `ia-traite` :

```bash
python3 /opt/data/code/ged-r2/ged_save.py /opt/data/spool/gmail/threads/<thread_id>
```

2. Vérifier la sortie JSON (`count` = nb de fichiers uploadés, `errors` vide).
   Un échec d'archivage **n'interrompt pas** le pipeline : l'incident est
   consigné dans `pipeline_runs` (cf. soul-addendum).

## Limites

- Clé R2 scopée au slug (`CLIENT_SLUG`) — jamais d'écriture hors
  `<prefix>/<slug>/…`.
- `delete` réservé au nettoyage de tests (`_hermes-test/`).
- Clés R2 uniquement via l'environnement.
