# Capability email-gmail (C1) — réception Gmail par alias client

**Type** : `mix` · **Statut** : contrat M2.1 — implémentation code + tests OK,
wiring OAuth + attach à M2.6

Collecte les emails pro arrivant sur l'alias Gmail du client
(`REDACTED_EMAIL` — filtre strict, D10) via un poller déterministe
exécuté par routine (cron `*/10 8-19`, heures creuses D1). Exporte les threads
vers le spool ; le marquage `ia-traite` pose l'idempotence de bout en bout.

## Composants

| Fichier | Rôle |
|---|---|
| [manifest.yaml](manifest.yaml) | Contrat : secrets OAuth, env (alias, label, max), code, skill, routine |
| [decision.md](decision.md) | Analyse mix (pas de Gmail natif/MCP — vérifié 30-31/08) |
| [skill.md](skill.md) | Skill `gmail-poll` (procédure d'exécution du poller) |
| [routine.yaml](routine.yaml) | Routine `email-poll` (cron, prompt complet activé M2.6) |
| [code/gmail_poll.py](code/gmail_poll.py) | Poller déterministe (OAuth, query +AREV, parsing threads, exit codes 0/2/3) |
| [code/gmail_label.py](code/gmail_label.py) | Marquage `ia-traite` (crée le label si absent, idempotent) |
| [soul-addendum.md](soul-addendum.md) | Refus : jamais d'envoi, jamais d'autres alias, jamais de creds |
| [tests/test.sh](tests/test.sh) | Contrat + unitaires (fixtures locales, sans réseau) |

## Secrets requis (dans `HermesConfig/clients/<slug>/client.env`, 600)

| Variable | Rôle | Où l'obtenir |
|---|---|---|
| `GMAIL_CLIENT_ID` | OAuth client (type Desktop) | Google Cloud Console → APIs & Services → Credentials |
| `GMAIL_CLIENT_SECRET` | Secret du client OAuth | Idem |
| `GMAIL_REFRESH_TOKEN` | Token offline (scope `gmail.modify`) | `scripts/gmail-oauth-setup.sh` (owner de la boîte) |

Env non secrètes : `GMAIL_USER_EMAIL`, `GMAIL_ALIAS_TAG=+AREV`,
`GMAIL_LABEL_DONE=ia-traite`, `GMAIL_MAX_THREADS=5`.

## Setup OAuth (à faire par le propriétaire de la boîte)

1. Google Cloud : créer un projet → activer **Gmail API** → écran de consentement
   (app interne/test) → créer un **OAuth client ID type Desktop**
2. Renseigner `GMAIL_CLIENT_ID` + `GMAIL_CLIENT_SECRET` (bashrc local pour test,
   `client.env` pour runtime)
3. Exécuter : `./scripts/gmail-oauth-setup.sh` (en tant que l'owner de la boîte)
   → il ouvre l'URL d'autorisation, capture le code (loopback), échange contre
   le **refresh token** (scope `gmail.modify`, offline)

## Coûts / quotas

Gmail API : quota gratuit largement suffisant (poll 10 min ≈ 6 req/h + threads).
Aucun coût financier. Confidentialité : boîte contrôlée par Redouane (D4 note).

## Historique

- 2026-09-01 : création capability (M2.1) — code + fixtures + tests verts
  (contrat v1.1 `code/` introduit)
