# app-install-init-pr

## Why

Today the GitHub App authenticates webhooks and runs `runDispatch` in-proc — useful for local debugging but it duplicates work the shim workflow already does in the user's repo. Worse, installing the App on a fresh repo does nothing visible: the user must still run `openspec-flow install` (or copy the shim by hand) before any flow works. The App's real value is two things that only it can deliver: (1) zero-touch scaffolding on install, and (2) `openspec-flow[bot]` identity on the commits/PRs the shim opens. Make those the App's job, and gate the in-proc dispatch behind an explicit dev-mode flag so prod has exactly one path per event.

## What Changes

- **New**: on `installation.created`, the App opens a per-repo "init" PR on branch `chore/openspec-flow-init` containing the same artefacts `openspec-flow install` produces — README badge block under H1, README install block appended, and `.github/workflows/openspec-flow.yml` shim. PR body explains the setup and links to docs.
- **New**: init PR creation is idempotent per repo. Skip the repo when both README managed regions exist AND the workflow file exists. Skip when `chore/openspec-flow-init` branch or an open PR from it is already present.
- **New**: env flag `OPENSPEC_FLOW_DISPATCH_MODE` with values `action` (default) and `in-process`. Probot's `issues` / `pull_request` handlers SHALL no-op when the flag is not `in-process`. The `installation.created` handler ignores the flag.
- **New**: Probot logs `dispatch-mode=<value>` on boot so the active path is observable.
- **New**: CLI command `openspec-flow app-init --repo <owner/name> [--dry-run] [--token <t>]`. With `--dry-run` (default), fetches remote README + workflow state via the GitHub API and prints the planned changes without writing. Without `--dry-run`, opens the init PR for real. Same `runAppInit(deps, repo, { dryRun })` core the webhook handler calls — no second implementation.
- **Modified**: rendering helpers in `src/install/templates.ts` are reused by the App handler. No change to CLI behaviour. Template module stays the single source of truth for badge/block/shim content.
- **Out of scope** (this change): `installation_repositories.added`, Anthropic API key wiring, App-managed Actions secrets for App ID / private key. Init PR body documents the manual `gh secret set` step, same as CLI install does today.

## Capabilities

### New Capabilities

- `app-install-init`: the install-bootstrap capability — a shared `runAppInit` core invoked by both (a) the Probot `installation.created` handler and (b) the `openspec-flow app-init` CLI. Plans/applies the per-repo init PR with the shim workflow and managed README regions, with per-repo idempotency and a dry-run mode that prints the plan without writing.

### Modified Capabilities

- `openspec-flow`: adds the `OPENSPEC_FLOW_DISPATCH_MODE` flag and the requirement that Probot in-proc dispatch only fires when the flag is `in-process`. The flag has no effect on Action-mode dispatch (which only ever runs in the user's runner).

## Impact

- `src/index.ts` — adds `installation.created` handler; adds dispatch-mode guard to existing `issues` / `pull_request` handlers; adds boot-time log line.
- `src/install/templates.ts` — exported renderers reused by the new App handler. Possibly minor refactor so badge / install-block / shim renderers each return string + target path tuples without filesystem coupling.
- New module `src/app-install/` containing `runAppInit`, GitHub API calls (create branch, put files via Contents API, open PR), idempotency checks, and a `--dry-run` planner.
- `src/cli.ts` — register new `app-init` subcommand wired to `runAppInit`.
- Tests: unit tests for the handler against a mocked Octokit + Probot context; smoke test asserting `issues.labeled` is a no-op when `DISPATCH_MODE!=in-process` and dispatches when it is.
- Docs: `CLAUDE.md` § Install modes gains the dispatch-mode flag and the App-mode init-PR behaviour. `README.md` install section calls out that App users get the init PR for free.
- No change to Action-mode runtime, no change to the label contract, no change to `intent-recognition`.
