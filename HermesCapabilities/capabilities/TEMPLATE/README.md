# Capability TEMPLATE

**Type** : natif / mix / sidecar (voir [decision.md](decision.md))

## Compétence métier

Une phrase : ce que l'agent sait faire grâce à cette capability.

## Composants

| Fichier | Rôle |
|---|---|
| [manifest.yaml](manifest.yaml) | Contrat (secrets, env, mcp, skills, routines) |
| [decision.md](decision.md) | Analyse natif/mix/sidecar + re-vérifications |
| [skill.md](skill.md) | Skill Hermes (si manifest.skills non vide) |
| [mcp.json](mcp.json) | Config MCP (si manifest.mcp non vide) |
| [routine.yaml](routine.yaml) | Routines cron (si manifest.routines non vide) |
| [soul-addendum.md](soul-addendum.md) | Clauses mergées dans le SOUL.md client |
| [tests/test.sh](tests/test.sh) | Tests unitaires |

## Secrets requis (noms — valeurs dans `clients/<slug>/client.env`, 600)

| Variable | Rôle | Où l'obtenir |
|---|---|---|
| | | |

## Coûts / quotas

Documenter tout appel API payant (OCR, embeddings…) et son estimation.

## Historique

- 2026-08-30 : création (TEMPLATE)
