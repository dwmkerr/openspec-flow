## Why

Action-mode install today is a copy-paste exercise: target-repo owners
must read `docs/architecture.md`, hand-craft `.github/workflows/openspec-flow.yml`,
remember which three secrets to set, and figure out where to advertise
the install in their README. RFC `rfc-shim-architecture` (#26) decided
the right shape is a one-shot `npx @dwmkerr/openspec-flow init` that
writes the shim files, reports secret state, and tells the user what
to commit. Issue #45 scopes the **thinnest viable slice** of that CLI —
no auto-PR, no IDE detection, no schema validation, no animated welcome.

Shipping the thin slice now unblocks the install funnel and lets every
follow-up (auto-open setup PR, IDE skill install, schema, etc.) layer
onto a stable file-writing contract.

## What Changes

- **New `init` subcommand on the existing `openspec-flow` CLI** (the
  binary already exposed by `src/cli.ts` per `wire-agent-runtime`).
  Invoked as `npx @dwmkerr/openspec-flow init`.
- **Writes three artefacts** in the target repo:
  - `.github/workflows/openspec-flow.yml` — the reusable-workflow
    shim that `uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v1`
    and passes the three secrets through.
  - `.openspec-flow.yaml` — commented stub config, no schema yet.
  - `README.md` patch between `<!-- openspec-flow:install-start -->`
    and `<!-- openspec-flow:install-end -->` markers. If markers are
    absent, the markers + content are appended once.
- **Secret presence report**: when `gh` is on `PATH` and authenticated,
  runs `gh secret list` once and prints a check/cross line per required
  secret (`ANTHROPIC_API_KEY`, `OPENSPEC_FLOW_APP_ID`,
  `OPENSPEC_FLOW_PRIVATE_KEY`). Read-only — no `gh secret set`.
- **Idempotent**: re-running on a repo already initialised is a no-op
  per artefact. `--force` overwrites unconditionally; without it,
  drifted artefacts are reported and exit code is non-zero.
- **TTY-gated prompts** via `@inquirer/prompts`. `--yes` (or non-TTY
  stdin) skips all prompts and uses defaults.
- **CLI ergonomics** from `commander` (parsing) + `chalk` (colour) +
  `ora` (spinner during the `gh secret list` call). `@inquirer/core`
  is pulled in transitively; declared explicitly for typing.
- **Final stdout block** instructs the user to `git add` + `git commit`
  + `git push` the changes themselves. **No PR opened by the CLI.**
- **Smoke test** at `tests/integration/shim-init.test.ts` runs the
  command in a freshly initialised git repo under a tmp dir and asserts
  the three artefacts plus the exit code.

## Capabilities

### New Capabilities

- `init-command`: the `openspec-flow init` subcommand. Owns the
  contract for which files the shim writes, the README marker block
  format, the secret-presence report, the idempotency rules, and the
  TTY / `--yes` / `--force` flag semantics.

### Modified Capabilities

- None at this slice. `agent-runtime` already declares the CLI seam
  and binary; `init` is a sibling subcommand and does not change
  existing requirements.

## Impact

- **New deps** (runtime): `commander`, `@inquirer/prompts`,
  `@inquirer/core`, `chalk` (already present), `ora`,
  `js-yaml` (for writing the `.openspec-flow.yaml` stub with stable
  formatting).
- **New files**:
  - `src/cli/init/index.ts` — subcommand entrypoint.
  - `src/cli/init/write-workflow.ts` — workflow file writer + idempotency.
  - `src/cli/init/write-config.ts` — `.openspec-flow.yaml` stub writer.
  - `src/cli/init/patch-readme.ts` — README marker patcher.
  - `src/cli/init/report-secrets.ts` — `gh secret list` reporter.
  - `src/cli/init/templates/openspec-flow.yml` — shim workflow template.
  - `src/cli/init/templates/openspec-flow.yaml` — config stub template.
  - `src/cli/init/templates/readme-block.md` — README install block.
  - `tests/integration/shim-init.test.ts` — smoke test.
- **Modified**: `src/cli.ts` — register `init` subcommand with
  `commander`. `package.json` — new deps + ensure `bin/openspec-flow`
  is published in the `files` array (already is).
- **Out of scope** (separate issues per #45 body):
  - Auto-open setup PR via App token.
  - IDE detection + `.claude/skills` / `.cursor/rules` install.
  - OpenSpec CLI detection + auto-`openspec init`.
  - `.openspec-flow.yaml` `zod` schema + validation.
  - Animated welcome screen.
  - `act` local-runner recipe.
  - Drift detection (already deferred in RFC).
- **Cost**: zero per-run cost — no Claude calls, no network beyond
  the optional `gh secret list`.
