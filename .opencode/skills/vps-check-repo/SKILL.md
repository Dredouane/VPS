---
name: vps-check-repo
description: >-
  Strict local non-regression checks of the VPS git repo (no SSH required):
  versioned secrets, sensitive files tracked, .gitignore coverage,
  repo visibility, local SSH config (Host nemo), ~/.bashrc alias.
  Use when the user says "check repo", "vps-check-repo", "hygiène du dépôt",
  "secrets versionnés", "vérifier le repo git", at the start of a session on
  this repo, or as part of vps-check-full.
---

# Repo check — local git hygiene (READ-ONLY, no SSH)

Skill **100 % local**, run from the repo root `/home/redouane/dev/VPS`.
Absolute rules:

1. **Strict READ-ONLY**: no modification of the repository (forbidden:
   `git add`, `git commit`, `git checkout`, `git clean`, `git stash`,
   creating/deleting files, `sed -i`). The skill reports, it never fixes.
2. **No secret displayed**: if a secret pattern matches, display
   only the file path + line number, **never the value**
   (truncate to 40 characters maximum).
3. Output: table `| Check | Statut | Detail |` with statuses `✓ PASS`,
   `✗ FAIL`, `~ WARN`, `⏭ SKIP` + global verdict (SAIN / ACTION REQUISE).
4. On FAIL: point to the remediation (§Remediation), apply nothing.

## Checks

R1 to R3: `git grep` returns rc=1 when there is no match → **rc=1 = PASS**.

| # | Check | Command | Expected |
|---|---|---|---|
| R1 | Secrets in tracked files | `git grep -nE 'sk-[A-Za-z0-9]{10,}\|ghp_[A-Za-z0-9]{20,}\|[0-9]{6,12}:AA[A-Za-z0-9_-]{30,}\|AIza[A-Za-z0-9_-]{30,}\|Bearer [A-Za-z0-9_-]{20,}'` | 0 matches |
| R2 | Sensitive files tracked | `git ls-files \| grep -E '\.(env\|key\|pem)$\|\.tar\.gz$\|Zone\.Identifier'` | empty (`.env.example` files are tolerated) |
| R3 | `spawn-agent.sh` (old script, dangling link) not versioned | `git ls-files \| grep spawn-agent` | empty |
| R4 | `backup.tar.gz` ignored | `git check-ignore Installation/backup.tar.gz` | returns the path (rc=0) |
| R5 | `*.env` ignored | `git check-ignore 'HermesConfig/clients/arev/client.env'` | rc=0 |
| R6 | `Zone.Identifier` artifacts ignored | `git check-ignore 'Installation/VPS_HARDENING_PLAN_FINAL.md:Zone.Identifier'` | rc=0 |
| R7 | GitHub repo PRIVATE | `gh repo view Dredouane/VPS --json visibility -q .visibility` | `PRIVATE` — if `gh` is absent/unauthenticated → `~ WARN` (do not FAIL) |
| R8 | Local SSH config `Host nemo` | `grep -A5 '^Host nemo$' ~/.ssh/config` | contains `User admin`, `Port $VPS_SSH_PORT`, `IdentityFile ~/.ssh/$VPS_SSH_KEY` |
| R9 | `syncthing-gui` alias (Syncthing GUI tunnel) | `grep syncthing-gui ~/.bashrc` | present (active line) |
| R10 | Old root@22 alias neutralized | `grep -n 'alias nemo' ~/.bashrc` | old alias `root@…:22` **commented** (prefixed by `#`); only the `nemo` → admin@$VPS_SSH_PORT SSH alias is active (in `~/.ssh/config`) |
| R11 | Tree state (informational) | `git status -sb` | note branch, modified files, ahead of `origin/main` — never FAIL |
| R12 | Local private keys never versioned | `git ls-files \| grep -cE '$VPS_KEY_BACKUP\|$VPS_SSH_KEY\|id_ed25519'` → **0**; `ls ~/.ssh/$VPS_KEY_BACKUP` present locally (info — the pull backup key exists only on the PC) | 0 tracked private key; the public key alone, if ever versioned, is tolerated |

## Report

1. Run each command, note the status.
2. Final table `| Check | Statut | Detail |`: for R1/R2, state
   `0 matches`; on failure, list file:line **without the value**.
3. Global verdict: **SAIN** if 0 FAIL, otherwise **ACTION REQUISE**.
4. Reminder: report regressions, fix nothing.

## Remediation (on FAIL)

| Check | Reference |
|---|---|
| R1-R3 (secrets/sensitive tracked) | root `README.md` (private repo warning) + `Installation/RAPPORT_AUDIT_2026-08-30.md` §5.5 (history purge procedure if already committed) |
| R4-R6 (.gitignore) | root `.gitignore` (backup / Zone.Identifier / secrets blocks) |
| R8-R10 (SSH/aliases) | `Installation/DOCUMENTATION_VPS.md` §1 (SSH access, configured aliases) |
| R7 (visibility) | GitHub → Settings → Danger Zone (manual) |
