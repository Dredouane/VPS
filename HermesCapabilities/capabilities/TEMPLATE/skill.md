---
name: template-skill
description: >-
  TEMPLATE skill HermesCapabilities — replace with the actual description.
  Frontmatter expected by Hermes (validate the exact format with
  `hermes skills list` on an instance before activation — M2).
---

# Skill TEMPLATE

> ⚠️ **Implementation note**: the exact location of custom skills in a
> dockerized instance (`/opt/data/skills/<name>/SKILL.md`?) still has to be
> validated in M2 (`hermes skills --help`, trial on the test instance). The
> `capability-attach.sh` copies this file to `data/skills/<id>/SKILL.md`
> on a best-effort basis and reports it as a warning.

## Role

Describe what the skill enables the agent to do, in business terms.

## When to use it

Describe the triggers (user request, routine, pipeline).

## Scope and limits

- Tools used: (MCP, API, files — reference the manifest)
- Never: recall the relevant refusals (the detail lives in the soul-addendum)

## Expected output

Describe the output format (Telegram message, vault note, RPC line…).
