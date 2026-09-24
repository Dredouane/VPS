# Decision — Capability email-gmail (C1)

> Order of rule: **NATIVE > MIX > SIDECAR** (ARCHITECTURE.md §2).
> **M2.1-bis revision (01/09)**: reception based on **IMAP app password**
> (decision D13) — the OAuth API modules have been replaced.

## Need

Receive the client's professional emails (+AREV alias of a controlled
mailbox) and export them to the spool (threads + attachments) — without
exposing the agent to more scope than necessary, with idempotent
processing.

## Options evaluated

| Option | Verified | Verdict |
|---|---|---|
| Native: MCP Gmail catalog / Hermes email support / `hermes webhook` | ❌ none (v0.20.6, 08/30-31 — webhook unusable headless) | ❌ |
| Mix OAuth Gmail API | ⚠️ functional but **refresh token expires every 7 days** for an unverified Testing app (Google policy) | ❌ demoted to plan B |
| **Mix IMAP app password** (`imaplib` stdlib) | ✅ **verified live 01/09**: login, X-GM-RAW, X-GM-THRID, X-GM-LABELS | ✅ **kept** |
| Sidecar worker | separate code to maintain | ❌ |

## Decision (revised 01/09 — D13)

**MIX** (IMAP app password — D13) — `imap_poll.py` (readonly EXAMINE, X-GM-RAW
`to:+AREV -label:ia-traite newer_than:90d`, X-GM-THRID threading, RFC822
parsing via `email.parser` stdlib — **more deterministic** than the API MIME
tree) and `imap_mark_done.py` (move to `[Gmail]/ia-traite` label: COPY +
\Deleted + targeted UID EXPUNGE, skips if already labeled). Strict `+AREV`
filter (D10). Attachments as **spool files** (01/09 decision) — no binaries
in the JSON.

**Plan B**: OAuth API (helper `gmail-oauth-setup.sh` kept) — to consider
if the app password is revoked or after Google verification of the app
(stable refresh). The OAuth modules remain in the git history.

## Re-check

| Date | Hermes | Verdict unchanged? | Notes |
|---|---|---|---|
| 2026-08-31 | v0.20.6 | — (initial: OAuth) | catalog + gateway + webhook checked |
| 2026-09-01 | v0.20.6 | ✅ IMAP | live read-only probe (login/RAW/THRID/LABELS) |
