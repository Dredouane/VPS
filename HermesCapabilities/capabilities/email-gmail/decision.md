# Decision — Capability email-gmail (C1)

> Règle d'ordre : **NATIF > MIX > SIDECAR** (ARCHITECTURE.md §2).

## Besoin

Recevoir les emails pro du client (alias `+AREV` d'une boîte contrôlée)
et les exporter vers le pipeline (spool) — sans exposer l'agent à plus de
scope que nécessaire, avec idempotence de traitement.

## Options évaluées

| Option | Disponibilité vérifiée | Verdict |
|---|---|---|
| Natif : MCP Gmail du catalogue | ❌ absent du `hermes mcp catalog` (v0.20.6, vérifié 30/08) | ❌ |
| Natif : support email Hermes gateway | ❌ `hermes gateway/tools` : aucun email/imap (vérifié 31/08) | ❌ |
| Natif : `hermes webhook` (event-driven) | ⚠️ existe MAIS notre gateway headless n'active pas l'API HTTP (8642 inactif, vérifié 30/08) | ❌ pour M2 |
| **Mix** : skill + code OAuth (polling cron, scope `gmail.modify`) | ✅ pattern OAuth déjà validé (`SUREN_GMAIL_OAUTH_*` dans /etc/secrets) | ✅ **retenu** |
| Sidecar : worker Python dédié hors agent | code à maintenir séparé, orchestration compliquée | ❌ |

## Décision

**MIX** — le code déterministe (`gmail_poll.py`, `gmail_label.py`) vit dans
la capability (`code/`, stdlib Python, testé par fixtures) et l'agent
l'exécute via sa shell tool, déclenché par la routine cron (D1 : `*/10 8-19`,
heures creuses 20h-08h). OAuth via refresh token dédié AREV (scope
`gmail.modify` : read + pose du label `ia-traite`), pattern réutilisé de
SUREN. Filtre strict sur le destinataire `+AREV` (D10, multi-clients ready).

Plan B si besoin temps réel un jour : activer l'API gateway + `hermes
webhook` (réévaluer la version Hermes), ou Pub/Sub (D1 bis). MCP Gmail
communautaire à réévaluer à chaque montée de version (catalogue).

## Re-vérification

| Date | Hermes | Verdict inchangé ? | Notes |
|---|---|---|---|
| 2026-08-31 | v0.20.6 | — (décision initiale) | catalog + gateway + webhook vérifiés sur VPS |
