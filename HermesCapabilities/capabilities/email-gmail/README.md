# Capability email-gmail (C1) — IMAP reception via client alias

**Type**: `mix` · **Status**: M2.1-bis — IMAP code + green tests (including
real readonly integration), attach wiring at M2.6

Collects professional emails arriving on the client's Gmail alias
(`REDACTED_EMAIL` — strict filter, D10) via **IMAP app password**
(decision D13 — OAuth documented as plan B). Deterministic poller as a
routine (cron `*/10 8-19`, off-peak hours D1): readonly EXAMINE, X-GM-RAW,
X-GM-THRID, RFC822 parsing (`email.parser`), attachments as spool files,
`ia-traite` marking by move (idempotent).

## Components

| File | Role |
|---|---|
| [manifest.yaml](manifest.yaml) | Contract: IMAP secrets, env (alias, label, max, spool), code, skill, routine |
| [decision.md](decision.md) | IMAP revision (D13) — OAuth demoted to plan B (refresh expired every 7d in Testing) |
| [skill.md](skill.md) | Skill `gmail-poll` (poller procedure + marking) |
| [routine.yaml](routine.yaml) | Routine `email-poll` (cron, full prompt activated M2.6) |
| [code/imap_poll.py](code/imap_poll.py) | Deterministic poller (login, EXAMINE, X-GM-RAW/THRID, RFC822, spool, exit 0/2/3) |
| [code/imap_mark_done.py](code/imap_mark_done.py) | Marking: creates the label if missing, COPY + \Deleted + UID EXPUNGE, skips if already labeled |
| [soul-addendum.md](soul-addendum.md) | Refusals: never any sending, never other aliases, never quoting the password |
| [tests/test.sh](tests/test.sh) | Contract + unit tests (RFC822 fixtures, no network) + real readonly integration if creds |

## Required secrets (in `HermesConfig/clients/<slug>/client.env`, 600)

| Variable | Role |
|---|---|
| `VPS_GMAIL_RECEPTION_IMAP_ADRESS` | Mailbox address (`REDACTED_EMAIL` — spelling kept as is) |
| `VPS_GMAIL_RECEPTION_IMAP_MDP` | IMAP app password (Gmail 2FA required; IMAP enabled — verified live 01/09) |

Non-secret env: `GMAIL_ALIAS_TAG=+AREV`, `GMAIL_LABEL_DONE=ia-traite`,
`GMAIL_MAX_THREADS=5`, `GMAIL_SPOOL_DIR`, `GMAIL_NEWER_THAN_DAYS=90`.

Plan B: OAuth API (`scripts/gmail-oauth-setup.sh`) — refresh expires every
7d in Testing mode without app verification.

## Costs / quotas

IMAP: free, 10-min polling well below the limits. Privacy:
mailbox controlled by Redouane (D4 note).

## History

- 2026-09-01: original M2.1 (OAuth) revised — **D13: switch to IMAP app
  password** (existing creds, stability, deterministic parsing); OAuth
  modules removed (git history), helper kept as plan B.
