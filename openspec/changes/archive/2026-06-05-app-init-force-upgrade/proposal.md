# app-init-force-upgrade

## Why

When the upstream openspec-flow template gains new structure (e.g. the `permissions:` block or `id-token: write` for the OIDC broker), existing installs need a way to catch up. Today `runAppInit` is idempotent on marker-presence: re-running `app-init` on an installed repo returns `skipped: already-initialised`. There's no way to push an upgrade without cloning the target repo and running the local CLI's `install --force`.

This change adds a `--force` flag to `app-init` that bypasses both skip-checks, re-renders the shim + managed README regions from the current templates, and either opens a fresh upgrade PR or updates the existing init PR's branch in place.

## What Changes

- **New**: `runAppInit` accepts `opts.force: boolean`. When true, the planner runs with `force: true` (overwriting managed regions instead of leaving them alone), `allNoop` short-circuit is bypassed, and `pr-already-open` short-circuit is bypassed.
- **New**: when `force` is set and `pulls.create` returns 422 (a PR for this head already exists), the function lists open PRs from the head branch and returns the existing PR's URL. The branch's contents are already updated by `writeFiles`' force-update path, so the existing PR auto-shows the new commits.
- **New**: when `force` is set, the PR title becomes `chore: openspec-flow upgrade` (vs `chore: openspec-flow setup`) and the body's intro explains the upgrade scenario.
- **New**: CLI `app-init --force` flag exposes this.
- **Modified**: existing init paths unchanged — `force` defaults to false and all current callers omit it.

## Capabilities

### Modified Capabilities

- `app-install-init`: `runAppInit` gains an optional `force` parameter; the CLI `app-init` command gains a `--force` flag. Behaviour without the flag is unchanged.

## Impact

- `src/app-install/index.ts` — `force` option threading, planner force=true, skip-bypass logic, 422-recovery on `pulls.create`, alternative PR title + body.
- `src/cli.ts` — `--force` flag.
- Tests cover (a) force bypasses `already-initialised`, (b) force recovers from `pulls.create` 422 with the existing PR URL.
- No spec change beyond `app-install-init`. No new App permissions.
