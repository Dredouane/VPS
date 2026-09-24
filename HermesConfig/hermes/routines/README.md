# ⏰ Routines (Hermes cron) — HermesConfig

**Routines** are recurring responsibilities that belong to a
bot (rule: no routine on the main agent without a reason — see
`../bots/README.md`). Headless tool: `hermes cron` (works in the
container, no Desktop needed).

## Useful commands (in the container)

```bash
docker exec -it hermes-<slug>-pro bash
hermes cron list                     # existing jobs
hermes cron create --profile ops "0 7 * * 1" "Task…"   # creation
hermes cron run <id>                 # execution at the next tick
hermes cron pause / resume <id>
hermes cron history                  # execution history
hermes cron incidents                # incidents
```

## Recommended routine catalogue (SME client)

| Routine | Frequency | Bot | Purpose |
|---|---|---|---|
| Weekly report | mon 07:00 | Ops | Synthesis of the week → Telegram + vault |
| Vault check | daily 06:30 | Ops | Write OK + data-dir space |
| Deadline reminder | daily 08:00 | Principal* | Quotes/invoices approaching deadline (vault read) |
| Crons watching | daily 09:00 | Ops (or "Cronfather") | Check the other crons, escalate failures |

\* accepted exception if the routine is purely "read + message".

## Rules

1. **Never a secret in plain text** in a routine (go through env/config).
2. Each routine is **reviewed by the provider** before activation.
3. Each routine is **documented in the client vault** (name, frequency,
   expected output, what to do if it fails).
4. A routine that fails **2 times** → human escalation (see
   `../bots/ops-bot.example.md`).
5. After redeploying the container: check `hermes cron list` (the jobs'
   state lives in the persistent data-dir `/opt/data`, so it survives a
   restart — to be verified after a `down -v` that would destroy everything).
