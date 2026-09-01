---
name: gmail-poll
description: >-
  Poller email de l'agent : lance le module déterministe imap_poll.py pour
  récupérer les threads Gmail non traités de l'alias client (+AREV) via IMAP
  (app password) et les exporter vers le spool (threads + PJ). Exécuté par la
  routine email-poll (cron 8h-19h) ou à la demande. Utiliser quand il faut
  traiter les nouveaux emails reçus.
---

# Skill gmail-poll

## Rôle

Collecter les nouveaux emails professionnels de l'alias client et préparer le
travail du pipeline (thread-parser → OCR → RAG → experts).

## Procédure

1. Exécuter le poller déterministe (jamais d'IMAP ad-hoc dans une session) :

```bash
python3 /opt/data/code/email-gmail/imap_poll.py
```

2. Lire la sortie stdout (`{"count", "thread_ids", "spool_dir"}`) :
   - `count == 0` → rien à faire, terminer.
   - Pour chaque thread : lire
     `<spool_dir>/threads/<thread_id>/thread.json` puis suivre le pipeline
     (C2 thread-parser — PIPELINE_EMAIL_AREV.md §2). Les PJ sont des
     **fichiers spool** (champ `path` des attachments).
3. Marquage `ia-traite` UNIQUEMENT en fin de pipeline réussie :
   `python3 /opt/data/code/email-gmail/imap_mark_done.py <uid> …`
   (déplacement vers label, idempotent — skip si déjà labelisé).

## Limites

- Max 5 threads par run (D12) — un pic d'emails s'étale sur plusieurs runs.
- Lecture = EXAMINE + BODY.PEEK (jamais de flag \Seen posé en lecture) ;
  le mode écriture n'est utilisé que par `imap_mark_done.py`.
- Ne JAMAIS passer le mot de passe IMAP sur la ligne de commande (env only).
