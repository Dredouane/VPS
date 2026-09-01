# Decision — Capability email-gmail (C1)

> Règle d'ordre : **NATIF > MIX > SIDECAR** (ARCHITECTURE.md §2).
> **Révision M2.1-bis (01/09)** : réception basée sur **IMAP app password**
> (décision D13) — les modules OAuth API ont été remplacés.

## Besoin

Recevoir les emails pro du client (alias `+AREV` d'une boîte contrôlée)
et les exporter vers le spool (threads + PJ) — sans exposer l'agent à plus
de scope que nécessaire, avec idempotence de traitement.

## Options évaluées

| Option | Vérifié | Verdict |
|---|---|---|
| Natif : MCP Gmail catalogue / support email Hermes / `hermes webhook` | ❌ aucun (v0.20.6, 30-31/08 — webhook inutilisable headless) | ❌ |
| Mix OAuth Gmail API | ⚠️ fonctionnel mais **refresh token expiré tous les 7 jours** pour une app Testing non vérifiée (politique Google) | ❌ rétrogradé en plan B |
| **Mix IMAP app password** (`imaplib` stdlib) | ✅ **vérifié live 01/09** : login, X-GM-RAW, X-GM-THRID, X-GM-LABELS | ✅ **retenu** |
| Sidecar worker | code séparé à maintenir | ❌ |

## Décision (révisée 01/09 — D13)

**MIX** (IMAP app password — D13) — `imap_poll.py` (EXAMINE readonly, X-GM-RAW
`to:+AREV -label:ia-traite newer_than:90d`, X-GM-THRID threading, parsing
RFC822 via `email.parser` stdlib — **plus déterministe** que l'arbre MIME API)
et `imap_mark_done.py` (déplacement vers label `[Gmail]/ia-traite` : COPY +
\Deleted + UID EXPUNGE ciblé, skip si déjà labelisé). Filtre strict `+AREV`
(D10). PJ en **fichiers spool** (décision 01/09) — pas de binaires dans le JSON.

**Plan B** : OAuth API (helper `gmail-oauth-setup.sh` conservé) — à considérer
si app password révoqué ou après vérification Google de l'app (refresh stable).
Les modules OAuth restent dans l'historique git.

## Re-vérification

| Date | Hermes | Verdict inchangé ? | Notes |
|---|---|---|---|
| 2026-08-31 | v0.20.6 | — (initial : OAuth) | catalog + gateway + webhook vérifiés |
| 2026-09-01 | v0.20.6 | ✅ IMAP | sonde live read-only (login/RAW/THRID/LABELS) |
