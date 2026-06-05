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

The PR body opened by `runAppInit` SHALL contain a section that names the three Actions secrets the workflow requires, with the exact `gh secret set` commands (filled in with the target repo) the user must run before the first `openspec:go`:

- `ANTHROPIC_API_KEY` — Anthropic API key for the agent.
- `OPENSPEC_FLOW_APP_ID` — App id for bot identity.
- `OPENSPEC_FLOW_PRIVATE_KEY` — App private key for bot identity.

The body SHALL note that `OPENSPEC_FLOW_PRIVATE_KEY` may be set as an organisation-level secret to avoid repeating it per repo, and SHALL link forward to a follow-up issue tracking the OIDC token broker approach that removes the App-secret distribution requirement entirely.

The body SHALL explain the consequence of skipping the App secrets — namely that the workflow falls back to `GITHUB_TOKEN`, which cannot push files under `.github/workflows/*` and attributes commits to `github-actions[bot]` rather than the openspec-flow App.

#### Scenario: PR body names every secret command

- **WHEN** an init PR opens for `owner/repo`
- **THEN** the PR body contains the substring `gh secret set ANTHROPIC_API_KEY`
- **AND** the PR body contains the substring `OPENSPEC_FLOW_APP_ID`
- **AND** the PR body contains the substring `OPENSPEC_FLOW_PRIVATE_KEY`
- **AND** the PR body references `owner/repo`

#### Scenario: PR body explains the GITHUB_TOKEN fallback constraint

- **WHEN** an init PR opens
- **THEN** the PR body notes that workflows fall back to `GITHUB_TOKEN` when the App secrets are absent
- **AND** the body notes that `GITHUB_TOKEN` cannot write `.github/workflows/*`

#### Scenario: PR body suggests org-level secret for reuse

- **WHEN** an init PR opens
- **THEN** the PR body mentions the organisation-secret option for `OPENSPEC_FLOW_PRIVATE_KEY`

