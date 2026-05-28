## Why

The `rfc-shim-architecture` change (#26) established the shim-first install model: a thin reusable-workflow stub at `.github/workflows/openspec-flow.yml` in every target repo, owned by an `init` CLI and (later) the App. Nothing exists to write that file today. Users hand-roll workflows, paste secret names, and patch the README themselves — every install is a manual carry, and the contract drifts.

This change ships the **thinnest viable `openspec-flow init`** that puts the shim, a config stub, and a README block on disk in one command. It is the foundation under every later install enhancement (auto-PR, IDE detection, OpenSpec bootstrap, drift) tracked under #45.

## What Changes

- New binary `openspec-flow` exposed by `@dwmkerr/openspec-flow`. Subcommand `init` runs as `npx @dwmkerr/openspec-flow init` (or as a local install).
- `init` writes three artefacts in the target repo, idempotently:
  1. `.github/workflows/openspec-flow.yml` — the reusable-workflow shim per `rfc-shim-architecture` §Decision 5. Pinned to a versioned tag.
  2. `.openspec-flow.yaml` — commented config stub; no schema enforcement in this slice (schema deferred to #49).
  3. `README.md` — a managed install/usage block patched between machine-readable markers `<!-- openspec-flow:install-start -->` / `<!-- openspec-flow:install-end -->`. Content outside the markers is untouched.
- `init` reports the presence of `ANTHROPIC_API_KEY`, `OPENSPEC_FLOW_APP_ID`, `OPENSPEC_FLOW_PRIVATE_KEY` via `gh secret list` when `gh` is on PATH. Read-only — never writes secret values.
- `init` prints stdout instructions for the user to commit + push the resulting branch and open a PR titled `chore: openspec-flow setup`. **Auto-PR open is deferred** (#46) to keep this slice unauthenticated.
- TUI stack matches the `rfc-shim-architecture` research note: `commander`, `@inquirer/prompts`, `@inquirer/core`, `chalk`, `ora`. No animated banner in this slice (deferred to #50).
- Flags: `--yes` (skip all prompts), `--force` (overwrite hand-edited fields), `--no-secrets-check`, `--path <dir>` (default `.`).
- Re-run is a no-op unless `--force` is supplied.
- TTY-gated: non-TTY runs require `--yes` or exit non-zero with a clear message.

Explicitly **out of scope** in this change (each tracked as a follow-up issue):

- Auto-opening the setup PR with an App-minted token — #46
- IDE detection + skill/slash-command install (Claude Code, Cursor, Copilot) — #47
- Detecting absent OpenSpec scaffold and invoking `openspec init` — #48
- `.openspec-flow.yaml` zod schema + validation — #49
- Animated welcome screen — #50
- `act` local-runner recipe — #51
- Drift detection — already deferred in RFC; tracked separately

## Capabilities

### New Capabilities

- `shim-init`: defines the `openspec-flow init` command contract — argv, flags, artefacts written, idempotency rules, secret-state reporting, TTY/non-interactive handling, exit codes. Drift detection, auto-PR opening, and IDE-aware extensions sit outside this capability and will land as separate capabilities or modifications later.

### Modified Capabilities

None. `shim-distribution` (from `rfc-shim-architecture`) describes the shim file's contract; `shim-init` implements one writer of that file. Requirements in `shim-distribution` are not changing — only being given an implementation.

## Impact

- **Affected code**: new `src/cli/` module owning the `openspec-flow` binary, `src/cli/commands/init.ts`, `src/cli/templates/` (shim YAML, config YAML, README block), `src/cli/ui/` (palette + helpers). New `bin/openspec-flow.js` entry. Existing `src/handlers/` and `src/index.ts` are not touched.
- **Affected docs**: `README.md` gets a short `## Install (CLI)` section pointing at `npx @dwmkerr/openspec-flow init`. `docs/architecture.md` gains a note that `init` is the canonical local writer of the shim.
- **Affected build**: `package.json` adds the `bin` entry, adds runtime deps (`commander`, `@inquirer/prompts`, `@inquirer/core`, `chalk`, `ora`). Bundle size grows by ~120 KB unminified — acceptable for a one-shot CLI.
- **APIs**: none. Pure local filesystem + optional `gh` subprocess.
- **Infrastructure**: none. `init` runs entirely on the user's machine.
- **Dependencies**: 5 new runtime deps as listed. All MIT-licensed, ESM-native.
