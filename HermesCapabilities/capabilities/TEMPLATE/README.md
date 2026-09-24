# Capability TEMPLATE

**Type**: native / mix / sidecar (see [decision.md](decision.md))

## Business competency

One sentence: what the agent can do thanks to this capability.

## Components

| File | Role |
|---|---|
| [manifest.yaml](manifest.yaml) | Contract (secrets, env, mcp, skills, routines) |
| [decision.md](decision.md) | Native/mix/sidecar analysis + re-checks |
| [skill.md](skill.md) | Hermes skill (if manifest.skills is not empty) |
| [mcp.json](mcp.json) | MCP config (if manifest.mcp is not empty) |
| [routine.yaml](routine.yaml) | Cron routines (if manifest.routines is not empty) |
| [soul-addendum.md](soul-addendum.md) | Clauses merged into the client SOUL.md |
| [tests/test.sh](tests/test.sh) | Unit tests |

## Required secrets (names — values in `clients/<slug>/client.env`, 600)

| Variable | Role | Where to get it |
|---|---|---|
| | | |

## Costs / quotas

Document every paid API call (OCR, embeddings…) and its estimate.

## History

- 2026-08-30: creation (TEMPLATE)
