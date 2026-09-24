---
name: ged-archive
description: >-
  R2 archiving of raw email files: runs ged_save.py on the spool thread
  folder after extraction (slug = client subfolder). Reference copy of
  raw documents — to run systematically at the end of a successful
  polling.
---

# Skill ged-archive

## Role

Archive the raw files of each processed email to the R2 GED
(key `<prefix>/<slug>/emails/<thread_id>/…`) — reference copy before RAG.

## Procedure

1. After the successful poll (imap_poll) and BEFORE the `ia-traite`
   marking:

```bash
python3 /opt/data/code/ged-r2/ged_save.py /opt/data/spool/gmail/threads/<thread_id>
```

2. Check the JSON output (`count` = number of uploaded files, empty
   `errors`). An archiving failure **does not interrupt** the pipeline: the
   incident is recorded in `pipeline_runs` (cf. soul-addendum).

## Limits

- R2 key scoped to the slug (`CLIENT_SLUG`) — never write outside
  `<prefix>/<slug>/…`.
- `delete` reserved for test cleanup (`_hermes-test/`).
- R2 keys via the environment only.
