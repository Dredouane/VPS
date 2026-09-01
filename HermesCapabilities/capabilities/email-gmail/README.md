# Capability email-gmail (C1) — réception IMAP par alias client

**Type** : `mix` · **Statut** : M2.1-bis — code IMAP + tests verts (dont
intégration réelle readonly), wiring attach à M2.6

Collecte les emails pro arrivant sur l'alias Gmail du client
(`REDACTED_EMAIL` — filtre strict, D10) via **IMAP app password**
(décision D13 — OAuth plan B documenté). Poller déterministe en routine
(cron `*/10 8-19`, heures creuses D1) : EXAMINE readonly, X-GM-RAW,
X-GM-THRID, parsing RFC822 (`email.parser`), PJ en fichiers spool,
marquage `ia-traite` par déplacement (idempotent).

## Composants

| Fichier | Rôle |
|---|---|
| [manifest.yaml](manifest.yaml) | Contrat : secrets IMAP, env (alias, label, max, spool), code, skill, routine |
| [decision.md](decision.md) | Révision IMAP (D13) — OAuth rétrogradé plan B (refresh expiré 7j Testing) |
| [skill.md](skill.md) | Skill `gmail-poll` (procédure poller + marquage) |
| [routine.yaml](routine.yaml) | Routine `email-poll` (cron, prompt complet activé M2.6) |
| [code/imap_poll.py](code/imap_poll.py) | Poller déterministe (login, EXAMINE, X-GM-RAW/THRID, RFC822, spool, exit 0/2/3) |
| [code/imap_mark_done.py](code/imap_mark_done.py) | Marquage : crée le label si absent, COPY + \Deleted + UID EXPUNGE, skip si déjà labelisé |
| [soul-addendum.md](soul-addendum.md) | Refus : jamais d'envoi, jamais d'autres alias, jamais de mot de passe cité |
| [tests/test.sh](tests/test.sh) | Contrat + unitaires (fixtures RFC822, sans réseau) + intégration réelle readonly si creds |

## Secrets requis (dans `HermesConfig/clients/<slug>/client.env`, 600)

| Variable | Rôle |
|---|---|
| `GMAIL_RECEPTION_IMAP_ADRESS` | Adresse de la boîte (`REDACTED_EMAIL` — orthographe conservée) |
| `GMAIL_RECEPTION_IMAP_MDP` | App password IMAP (2FA Gmail requise ; IMAP activé — vérifié live 01/09) |

Env non secrètes : `GMAIL_ALIAS_TAG=+AREV`, `GMAIL_LABEL_DONE=ia-traite`,
`GMAIL_MAX_THREADS=5`, `GMAIL_SPOOL_DIR`, `GMAIL_NEWER_THAN_DAYS=90`.

Plan B : OAuth API (`scripts/gmail-oauth-setup.sh`) — refresh expiré 7j en
mode Testing sans vérification d'app.

## Coûts / quotas

IMAP : gratuit, polling 10 min largement sous les limites. Confidentialité :
boîte contrôlée par Redouane (D4 note).

## Historique

- 2026-09-01 : M2.1 initial (OAuth) révisé — **D13 : bascule IMAP app
  password** (creds existants, stabilité, parsing déterministe) ; modules
  OAuth retirés (historique git), helper conservé comme plan B.
