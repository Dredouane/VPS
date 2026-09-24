# 🔌 integration-hermesconfig.md — HermesCapabilities ↔ HermesConfig interface contract

> How the HermesConfig platform consumes capabilities. This contract
> will be implemented by **spawn-hermes-pro v3** (M3/M4). In M1/M2, attachment
> is done manually via `capability-attach.sh`.
> First concrete use case: AREV email pipeline — [`PIPELINE_EMAIL_AREV.md`](PIPELINE_EMAIL_AREV.md).

## 1. Target flow (spawn v3)

```
clients/<slug>/client.env
  ├── CLIENT_SLUG, Telegram tokens, LLM keys        (existing v2)
  ├── CAPABILITIES="rag-supabase email-gmail ..."   (new — list of ids)
  └── <SECRETS_DE_CAPABILITIES> (SUPABASE_URL, …)   (validated by the manifests)

spawn-hermes-pro.sh <slug>
  1. Validates client.env (existing) + secrets of ALL capabilities
     listed in CAPABILITIES (fail-fast before any deployment)
  2. Deploys the container (existing v2: compose, loopback, pinned image…)
  3. Attaches the capabilities: capability-attach.sh <slug> $CAPABILITIES
     (MCP → skills → routines → soul-addendum → capabilities.yaml)
  4. Health-check + final audit
```

## 2. Responsibilities

| Element | HermesConfig (platform) | HermesCapabilities (competences) |
|---|---|---|
| Container, network, ports, image | ✅ (D1-D10) | — |
| Base secrets (Telegram, LLM) | ✅ client.env | — |
| Capability secrets | client.env (storage) | manifests (validation + usage) |
| MCP / skills / routines | runtime injection | declarative definition |
| Base SOUL.md (client identity) | ✅ `clients/<slug>/soul.md` | per-capability addenda (marked merge) |
| State of attached capabilities | `instances/<slug>/` | `instances/<slug>/capabilities.yaml` |
| Tests | audit-hermes-pro.sh (fleet) | capability-test.sh (contracts) |

## 3. Interface rules

1. **Fail-fast**: a missing capability secret blocks the spawn (no
   half-competent instance in prod).
2. **Idempotence**: the attach is replayable (SOUL.md markers, state file,
   `hermes mcp add` tolerant of already-present).
3. **Update**: re-spawn = automatic re-attach of the capabilities listed
   in `capabilities.yaml` even if `CAPABILITIES` disappeared from client.env
   (state is authoritative, unless `--detach`).
4. **Capability rollback**: `--detach <cap-id>` (M2) removes MCP/skills/
   routines + marked SOUL.md block + state file entry. Data
   (Supabase schema) are NEVER destroyed by a detach.
5. **Drift**: HermesCapabilities on the VPS is a git mirror (like
   HermesConfig — invariant I14). Any change goes through the repo + rsync.

## 4. M2 sequence (real implementation of C5 on arev)

```bash
# 1. Test secrets (Supabase TEST project) in clients/arev/client.env
#    SUPABASE_URL / SUPABASE_RPC_KEY (capability role, RLS)
# 2. Schema + RPC on the Supabase TEST side (see capabilities/rag-supabase/README.md)
# 3. rsync HermesCapabilities → VPS (mirror)
# 4. Dry-run then attach:
sudo ./capability-attach.sh arev rag-supabase --dry-run
sudo ./capability-attach.sh arev rag-supabase
# 5. Integration tests (capability-test.sh rag-supabase --vps)
# 6. End-to-end validation: the agent indexes a test document and finds it again
```
