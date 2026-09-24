# 🧩 Skills — HermesConfig

Hermes has a **learning loop**: it creates and improves its own skills over
the course of its tasks. For a pro client, we **leave the loop active** but
we frame it.

## Principles

1. **Self-created skills**: stored in the persistent data-dir
   (`/opt/data`) → they survive restarts. List regularly and review:
   ```bash
   docker exec -it hermes-<slug>-pro hermes skills list
   ```
2. **Client custom skills** (cold start): to be defined in the client vault
   (`VPS/HermesConfig/<slug>/Skills.md`) — name, trigger, scope, outputs.
   SME works examples: `compte-rendu-chantier`, `relance-facture`,
   `resume-devis`.
3. **Scope**: a skill can never widen the `SOUL.md` refusals.
   Anything touching outbound network, files outside `/opt/vault` + `/opt/data`,
   or secrets is **refused by default**.
4. **Review after image version upgrade**: the bundled internal skills
   evolve with Hermes (`hermes skills` shows user-modified ones).

## Optional integrations (enable only if the client needs it)

| Integration | Usage | Note |
|---|---|---|
| **Firecrawl** | OCR of scanned documents (paper invoices, acceptance reports) | SME works case: likely — API key to store in `client.env`, never in plain text |
| **MCP** | Additional external tools | An MCP server = an attack surface: provider qualification before activation |
| **Bitwarden/1Password** | External secrets (`hermes secrets`) | Alternative to `client.env` if the client has a vault |

> Any activation is a decision documented in the vault
> (`Décisions HermesConfig.md`) and tested in staging before prod.
