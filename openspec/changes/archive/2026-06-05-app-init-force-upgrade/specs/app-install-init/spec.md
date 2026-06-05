# app-install-init Specification Delta

## ADDED Requirements

### Requirement: `runAppInit` supports a `force` option for upgrade-style invocations

`runAppInit` SHALL accept an optional `opts.force: boolean`. When true:

- The planner SHALL be invoked with `force: true` so managed README regions are overwritten from the current template instead of being left alone.
- The `allNoop → skipped: "already-initialised"` short-circuit SHALL be bypassed.
- The `hasOpenInitPR → skipped: "pr-already-open"` short-circuit SHALL be bypassed.
- The PR title SHALL be `chore: openspec-flow upgrade` instead of `chore: openspec-flow setup`.
- The PR body's lead sentence SHALL explain that this PR re-renders the shim + managed README regions from the current templates.
- When `pulls.create` returns 422 (an open PR for the head branch already exists), `runAppInit` SHALL look up the existing PR via `pulls.list({ head, state: "open" })` and return its URL rather than throwing.

When `force` is unset or false, behaviour SHALL be identical to today's `runAppInit`.

#### Scenario: Force re-renders an already-initialised repo

- **GIVEN** a repo whose default branch already contains both README markers and a workflow file (`allNoop` would normally return `skipped: already-initialised`)
- **WHEN** `runAppInit(..., { dryRun: false, force: true })` is called
- **THEN** the function does not return `skipped`
- **AND** the PR title is `chore: openspec-flow upgrade`
- **AND** `pulls.create` is invoked

#### Scenario: Force recovers from `pulls.create` 422 with the existing PR URL

- **GIVEN** the planner produced actions to write, the writer succeeded, and `pulls.create` rejects with status 422 (open PR already exists for this head)
- **WHEN** `force: true` is set
- **THEN** `runAppInit` returns the existing PR's URL via `pulls.list({ head, state: "open" })`

#### Scenario: Without force, behaviour unchanged

- **GIVEN** a fully-initialised repo
- **WHEN** `runAppInit(..., { dryRun: false })` is called without `force`
- **THEN** the result is `skipped: "already-initialised"` as before

### Requirement: CLI `app-init --force` exposes the upgrade path

The `openspec-flow app-init` command SHALL accept a `--force` flag. When set, it SHALL pass `force: true` to `runAppInit`. The flag SHALL be documented in `--help` as: force-upgrade — re-render shim + managed README regions from current templates even when already-initialised; bypasses the pr-already-open skip and force-updates the init branch in place.

#### Scenario: `--force` propagates

- **WHEN** the user runs `openspec-flow app-init --repo o/r --force`
- **THEN** the CLI invokes `runAppInit` with `{ force: true, ... }`
