---
name: gmail-poll
description: >-
  Email poller of the agent: runs the deterministic module imap_poll.py to
  fetch the client alias's (+AREV) unprocessed Gmail threads via IMAP
  (app password) and export them to the spool (threads + attachments). Run by
  the email-poll routine (cron 8am-7pm) or on demand. Use when the new
  received emails have to be processed.
---

# Skill gmail-poll

## Role

Collect the new professional emails of the client alias and prepare the
pipeline's work (thread-parser → OCR → RAG → experts).

## Procedure

1. Run the deterministic poller (never ad-hoc IMAP in a session):

```bash
python3 /opt/data/code/email-gmail/imap_poll.py
```

2. Read the stdout output (`{"count", "thread_ids", "spool_dir"}`):
   - `count == 0` → nothing to do, finish.
   - For each thread: read
     `<spool_dir>/threads/<thread_id>/thread.json` then follow the pipeline
     (C2 thread-parser — PIPELINE_EMAIL_AREV.md §2). Attachments are
     **spool files** (`path` field of the attachments).
3. `ia-traite` marking ONLY at the end of a successful pipeline:
   `python3 /opt/data/code/email-gmail/imap_mark_done.py <uid> …`
   (move to label, idempotent — skips if already labeled).

## Limits

- Max 5 threads per run (D12) — an email spike spreads over several runs.
- Reading = EXAMINE + BODY.PEEK (never the \Seen flag set on reading);
  write mode is used only by `imap_mark_done.py`.
- NEVER pass the IMAP password on the command line (env only).
