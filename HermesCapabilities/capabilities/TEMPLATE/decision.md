# Decision — Capability TEMPLATE (natif / mix / sidecar)

> Chaque capability documente ici sa décision technique. Règle d'ordre :
> **NATIF > MIX > SIDECAR** (voir `../../ARCHITECTURE.md` §2). La décision est
> **re-vérifiée à chaque montée de version Hermes** (catalogue MCP, skills
> bundlées) — reporter la version vérifiée ci-dessous.

## Besoin

Décrire le besoin métier en une phrase.

## Options évaluées

| Option | Disponibilité vérifiée (date, version Hermes) | Verdict |
|---|---|---|
| Natif (MCP catalogue / skill bundlée / routine) | | ✅ retenu / ❌ |
| Mix (API externe pilotée par skill/routine Hermes) | | |
| Sidecar (conteneur dédié) | | |

## Décision

**NATIF** — justification en 2-3 lignes : pourquoi c'est suffisant, quels sont
les limites connues, et quel est le plan B si la brique native disparaît.

## Re-vérification

| Date | Hermes | Verdict inchangé ? | Notes |
|---|---|---|---|
| 2026-08-30 | v0.20.6 | — (décision initiale) | |
