# app-install-init Specification

## Purpose
TBD - created by archiving change app-install-init-pr. Update Purpose after archive.
## Requirements
### Requirement: `installation.created` opens a per-repo init PR

The App SHALL handle the Probot `installation.created` event by invoking `runAppInit` once per repository included in the installation payload. For each repository that is not already initialised, `runAppInit` SHALL open a pull request from branch `chore/openspec-flow-init` against the repository's default branch, with a commit that:

- writes `.github/workflows/openspec-flow.yml` containing the shim workflow rendered for the installed CLI's version,
- inserts the badge managed region (`<!-- openspec-flow badge-start -->` … `<!-- openspec-flow badge-end -->`) under the README's first H1, creating `README.md` with a minimal template if absent,
- appends the install managed region (`<!-- openspec-flow install-start -->` … `<!-- openspec-flow install-end -->`) to the README.

The PR body SHALL explain what was added, document the `gh secret set ANTHROPIC_API_KEY` step the user must run, link to the openspec-flow docs, and SHALL NOT carry any `openspec:*` label.

#### Scenario: Fresh App install on a single uninitialised repo

- **GIVEN** the App is installed on `owner/repo`, the default branch is `main`, the README has no openspec-flow markers, and `.github/workflows/openspec-flow.yml` does not exist
- **WHEN** Probot receives `installation.created` for that installation
- **THEN** a pull request is opened against `main` from branch `chore/openspec-flow-init`
- **AND** the PR introduces the shim workflow file and both README managed regions
- **AND** the PR carries no `openspec:*` label

#### Scenario: Fresh App install spanning multiple repos

- **GIVEN** the App is installed on three uninitialised repos `owner/a`, `owner/b`, `owner/c`
- **WHEN** Probot receives `installation.created` listing all three
- **THEN** exactly one init PR is opened against each of the three repos

### Requirement: `runAppInit` is idempotent per repository

`runAppInit` SHALL skip opening a PR and return `skipped: "already-initialised"` when both README managed regions are present in `README.md` on the default branch AND `.github/workflows/openspec-flow.yml` exists on the default branch. It SHALL skip with `skipped: "pr-already-open"` when an open pull request from head `chore/openspec-flow-init` already exists in the repository.

#### Scenario: Re-install on an already-initialised repo

- **GIVEN** `owner/repo` already contains both README managed regions and the workflow file on its default branch
- **WHEN** Probot receives a fresh `installation.created` for `owner/repo`
- **THEN** no pull request is opened
- **AND** the handler logs `skipped: already-initialised` for that repo

#### Scenario: Re-install while a prior init PR is still open

- **GIVEN** an open PR from head `chore/openspec-flow-init` exists in `owner/repo`
- **WHEN** Probot receives a fresh `installation.created` for `owner/repo`
- **THEN** no new pull request is opened
- **AND** the handler logs `skipped: pr-already-open` for that repo

### Requirement: `openspec-flow app-init` CLI invokes the same core

The `openspec-flow` binary SHALL expose a top-level subcommand `app-init` accepting:

- `--repo <owner/name>` (required) — target repository
- `--dry-run` (default `false`) — compute and print the plan without writing
- `--token <value>` — explicit token; otherwise the CLI uses `GITHUB_TOKEN` if set, else `gh auth token`, else exits non-zero with a clear message

The command SHALL call the same `runAppInit` core the webhook handler calls. Default behaviour SHALL open the PR for real and print the PR URL (matching the local-`install` CLI's "act-by-default" semantics). With `--dry-run`, it SHALL print the planned files (paths + content lengths), the planned branch, the planned PR title, and the skip reason if applicable, then exit 0 without opening a PR.

#### Scenario: Dry-run preview against a fresh repo

- **WHEN** `openspec-flow app-init --repo owner/repo --dry-run` runs against a repo with no openspec-flow markers and no workflow file
- **THEN** stdout shows the planned branch `chore/openspec-flow-init`, the file paths `.github/workflows/openspec-flow.yml` and `README.md`, and the planned PR title
- **AND** no network writes occur (no branch created, no PR opened)
- **AND** the process exits 0

#### Scenario: Dry-run preview against an already-initialised repo

- **WHEN** `openspec-flow app-init --repo owner/repo --dry-run` runs against a repo whose default branch already contains both managed regions and the workflow file
- **THEN** stdout reports `skipped: already-initialised`
- **AND** the process exits 0

#### Scenario: Live run opens a PR

- **WHEN** `openspec-flow app-init --repo owner/repo` runs against a fresh repo and authentication succeeds
- **THEN** a pull request is opened identical to the one the webhook handler would open
- **AND** stdout prints the PR URL
- **AND** the process exits 0

#### Scenario: Missing token exits non-zero

- **WHEN** `openspec-flow app-init --repo owner/repo` runs with no `--token`, no `GITHUB_TOKEN`, and `gh auth token` unavailable
- **THEN** stderr names the missing credential
- **AND** the exit code is non-zero

### Requirement: Init PR body documents the manual secret setup

The PR body opened by `runAppInit` SHALL contain a section that names the `ANTHROPIC_API_KEY` Actions secret as required, with the exact `gh secret set ANTHROPIC_API_KEY -R <owner>/<name>` command (filled in with the target repo) the user must run before the first `openspec:go`.

#### Scenario: PR body names the secret command

- **WHEN** an init PR opens for `owner/repo`
- **THEN** the PR body contains the literal string `gh secret set ANTHROPIC_API_KEY -R owner/repo`

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

