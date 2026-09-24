# Decision — Capability TEMPLATE (native / mix / sidecar)

> Each capability documents its technical decision here. Order of rule:
> **NATIVE > MIX > SIDECAR** (see `../../ARCHITECTURE.md` §2). The decision is
> **re-checked at every Hermes version bump** (MCP catalog, bundled
> skills) — report the checked version below.

## Need

Describe the business need in one sentence.

## Options evaluated

| Option | Verified availability (date, Hermes version) | Verdict |
|---|---|---|
| Native (MCP catalog / bundled skill / routine) | | ✅ kept / ❌ |
| Mix (external API driven by Hermes skill/routine) | | |
| Sidecar (dedicated container) | | |

## Decision

**NATIVE** — justification in 2-3 lines: why it is sufficient, what the
known limitations are, and what the plan B is if the native component
disappears.

## Re-check

| Date | Hermes | Verdict unchanged? | Notes |
|---|---|---|---|
| 2026-08-30 | v0.20.6 | — (initial decision) | |
