# Local setup — personal values out of the repo

The repository is deliberately free of deployment identifiers. All values that
identify your infrastructure (IP, hostname, SSH port/key, device IDs) live in
**local files only**, never committed.

Placeholders used in the docs (`[VPS_IP]`, `[VPS_HOSTNAME]`, `[VPS_SSH_PORT]`,
`[VPS_SSH_KEY]`, `[SYNCTHING_DEVICE_ID]`, `[TAILSCALE_IP]`, …) map to the
variables defined in `.env.example`.

## Where the real values live

1. **`~/.bashrc`** — primary source of truth: a "VPS infrastructure identity"
   block exports `VPS_IP`, `VPS_HOSTNAME`, `VPS_SSH_PORT`, `VPS_SSH_KEY`,
   `VPS_SSH_ALIAS`, `SYNCTHING_DEVICE_ID`, `TAILSCALE_IP`, `DESKTOP_DEVICE`.
   Any new shell / script picks them up automatically.
2. `VPS/.env.local` (gitignored) — tooling that loads an `.env` file: it simply
   sources `~/.bashrc`, so the two can never drift apart.
3. `~/.ssh/config` — the SSH alias used everywhere in these docs:
   ```
   Host <alias>
       HostName <VPS_IP>
       Port <VPS_SSH_PORT>
       User admin
       IdentityFile ~/.ssh/<VPS_SSH_KEY>
   ```

## Internal working files

`internal/` (gitignored) holds session notes, handoff plans, personal agent
configs and OpenCode planning artifacts. They stay available on your machine
but are excluded from the repository and its history.

> `.opencode/skills/vps-check-*` that target the personal fleet also live in
> `internal/opencode-skills-personal/` — copy them back under `.opencode/skills/`
> locally if your OpenCode session needs them.
