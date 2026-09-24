# 🤖 Bot Mode — Rules and roles (HermesConfig)

## What it is

A **Bot** = a real Hermes profile (`~/.hermes/profiles/<name>/` natively,
equivalent in `HERMES_HOME` in Docker) with: its own `SOUL.md`, **isolated
memory**, model, skills, tools, MCP, sessions and **routines (cron)**.

⚠️ **Bot Mode is first a Desktop UX** (roster, @mentions, group chats of 2-6
bots, serialized turns) — but **the profiles work very well in
headless Docker**: cron routines attach to profiles server-side
(`hermes cron …` in the container), and orchestration can go through
kanban/peer. The Desktop interface is only required for visual supervision
of group chats.

## Bot vs Subagent decision rule

| Criterion | Subagent | Bot |
|---|---|---|
| One-off task | ✅ | ❌ |
| Recurring role | ❌ | ✅ |
| Own memory/history | ❌ | ✅ |
| Specialized model/skills/tools | ❌ | ✅ |
| Callable by role by other bots | ❌ | ✅ |
| Recurring work (cron) | ❌ | ✅ |

**Maximum 2-4 bots per client.** Do not multiply: each bot = one
stable responsibility. Example "The Cronfather" (veille §3.1): a bot that
watches the others' crons and escalates to the human — relevant when the
number of routines grows.

## Recommended roles for an SME client (creation order)

1. **Principal** (the client's agent, spawned by `spawn-hermes-pro.sh`) —
   Telegram interface, daily work. *Not a separate bot: it is the
   default profile of the container.*
2. **Ops** — monitoring, cron routines (backup check, monitoring, reminders),
   escalation. See `ops-bot.example.md`.
3. *(optional)* **Researcher** — multi-source web monitoring, document OCR
   (Firecrawl), documentary summaries.
4. *(optional)* **Content/Admin** — writing reports, payment reminders,
   recurring administrative documents.

## Headless creation (in the container)

```bash
docker exec -it hermes-<slug>-pro bash   # or docker compose exec
hermes profile create ops
# edit the profile's SOUL.md, then attach a routine:
hermes cron create --profile ops "0 7 * * 1" "Weekly report: summary of the week in /opt/vault"
hermes cron list
```

Each created bot/routine must be **documented in the client vault**
(`VPS/HermesConfig/<slug>/Bots et routines.md`): name, role, routine, what
it knows/can/refuses.

## Non-negotiable

- The Ops bot does not touch the scope of other clients (same isolation).
- Routines **never** contain secrets in plain text (go through env/config).
- Any new routine is reviewed by the provider before activation.
