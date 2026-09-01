---
name: gmail-poll
description: >-
  Poller email de l'agent : lance le module déterministe gmail_poll.py pour
  récupérer les threads Gmail non traités de l'alias client (+AREV) et les
  exporter vers le spool. Exécuté par la routine email-poll (cron 8h-19h) ou
  à la demande. Utiliser quand il faut traiter les nouveaux emails reçus.
---

# Skill gmail-poll

## Rôle

Collecter les nouveaux emails professionnels de l'alias client et préparer le
travail du pipeline (thread-parser → OCR → RAG → experts).

## Procédure

1. Exécuter le poller déterministe (jamais d'appel Gmail direct ad-hoc) :

```bash
python3 /opt/data/code/email-gmail/gmail_poll.py > /opt/data/spool/gmail/poll-$(date +%s).json
```

2. Lire la sortie JSON (`{"threads": [...], "count": N}`) :
   - `count == 0` → rien à faire, terminer.
   - Pour chaque thread : stocker le JSON dans
     `/opt/data/spool/gmail/threads/<thread_id>.json` puis suivre le pipeline
     (C2 thread-parser — voir PIPELINE_EMAIL_AREV.md §2).
3. Le marquage `ia-traite` se fait UNIQUEMENT en fin de pipeline réussie
   (`gmail_label.py`) — jamais en cas d'erreur partielle.

## Limites

- Max 5 threads par run (D12) — un pic d'emails s'étale sur plusieurs runs.
- Les pièces jointes sont référencées par `attachment_id` (téléchargement
  paresseux par l'OCR, C3) — le spool ne contient pas les binaires.
- Ne JAMAIS passer les credentials sur la ligne de commande (ils sont dans
  l'environnement du conteneur).
