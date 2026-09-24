# 🤖 HermesConfig — Professional deployment of Hermes agents for SMB clients

Sub-project dedicated to installing **Hermes Agent** agents (Nous Research) in a
**professional, per-client variabilized** configuration on the hardened VPS
(`$VPS_HOSTNAME`). Successor to the historical `spawn-hermes.sh` fleet: same
Docker philosophy, higher level of security and robustness.

> 🔒 **No secrets are versioned here.** Actual `client.env` files live on the
> VPS only (`.gitignore` covers `*.env`). The `.env.example` files are
> skeletons with placeholders.

---

## 🧭 Principles (non-negotiable)

1. **Least privilege** — minimal Docker caps, non-root UID `10000`, ports bound to `127.0.0.1`.
2. **Zero secrets in YAML / CLI / git** — everything goes through `clients/<slug>/client.env` (600).
3. **Pinned image** — never any `latest` in generated composes.
4. **Client can easily take over** — explicit `SOUL.md` (knows / can / refuses / escalates), vault runbook.
5. **Measured Bot Mode** — max 2-4 stable roles, no subagent proliferation.
6. **Total variabilization** — a new client = copy `clients/TEMPLATE/`, fill in 2-3 variables, `spawn-hermes-pro.sh <slug>`.

## 📂 Structure

```
HermesConfig/
├── README.md                      ← This file
├── VEILLE_HERMES_2026-08.md       ← State-of-the-art tech watch (August 2026)
├── ARCHITECTURE.md                ← Architecture decisions (ADR)
├── DEPLOYMENT.md                  ← Step-by-step VPS deployment guide
├── docker/
│   └── docker-compose.yml.template← Secure template (placeholders __VAR__)
├── clients/
│   ├── TEMPLATE/                  ← Skeleton to copy for a new client
│   │   ├── client.env.example
│   │   └── soul.md
│   └── arev/                      ← Client #1: AREV Travaux (construction/works SMB)
├── hermes/
│   ├── config.yaml.example        ← Pro runtime config (redact_secrets, model…)
│   ├── bots/                      ← Bot Mode: rules + examples (Ops…)
│   ├── routines/                  ← Cron routines per bot
│   └── skills/                    ← Custom client skills
└── scripts/
    ├── spawn-hermes-pro.sh        ← Client deployment (idempotent)
    └── audit-hermes-pro.sh        ← Pro fleet health/security audit (read-only)
```

## 🚀 Quickstart (on the VPS)

```bash
cd /home/admin/hermes-fleet/HermesConfig

# 1. New client: copy the template
cp -r clients/TEMPLATE clients/monclient
vim clients/monclient/client.env   # bot token, allowed users, LLM key
vim clients/monclient/soul.md      # adapt the contract to the client

# 2. Deploy
./scripts/spawn-hermes-pro.sh monclient

# 3. Verify
./scripts/audit-hermes-pro.sh
```

## 🔗 Links

- Tech watch & official sources: [`VEILLE_HERMES_2026-08.md`](VEILLE_HERMES_2026-08.md)
- Architecture decisions: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Full deployment procedure: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- **Part 2 — modular skills**: [`../HermesCapabilities/README.md`](../HermesCapabilities/README.md)
- Global VPS doc: [`../Installation/DOCUMENTATION_VPS.md`](../Installation/DOCUMENTATION_VPS.md)
- Obsidian vault: `/home/syncthing/obsidian-vault/VPS/HermesConfig/` (ADR notes, runbook, fleet status)
