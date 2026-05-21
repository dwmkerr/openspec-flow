## ADDED Requirements

### Requirement: Shim file is a single, versioned reusable-workflow stub

The system SHALL define a "shim" as a single YAML file installed at
`.github/workflows/openspec-flow.yml` in every target repo. The file SHALL
consist of an `on:` block subscribing to `issues.labeled`, `pull_request.labeled`,
`issue_comment.created`, and `pull_request_review_comment.created`, and a single
`jobs.flow` entry that delegates to the published reusable workflow via
`uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@<ref>` where
`<ref>` is a published tag (e.g. `v0.2.0`) or a SHA.

The shim SHALL pass three secrets through: `ANTHROPIC_API_KEY` (required),
`OPENSPEC_FLOW_APP_ID` (optional, defaulted to empty), and
`OPENSPEC_FLOW_PRIVATE_KEY` (optional, defaulted to empty).

The shim SHALL NOT contain any business logic — no `run:` blocks, no `if:` filters,
no inline shell. Any non-`uses:` content is considered hand-authored and must be
preserved by the App and CLI when they update the file.

#### Scenario: Shim file structure
- **WHEN** a target repo contains `.github/workflows/openspec-flow.yml` written by
  the App or CLI
- **THEN** the file SHALL contain exactly one job named `flow` whose `uses:` line
  references `dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@<ref>`

#### Scenario: Shim updates preserve hand edits
- **WHEN** the App or CLI updates the shim to bump its `@<ref>` line
- **THEN** any lines outside the `uses:` token SHALL be preserved byte-for-byte
- **AND** the file SHALL remain valid YAML

### Requirement: App install opens an opt-in shim PR

The system SHALL respond to `installation.created` and
`installation_repositories.added` webhook events by opening a pull request against
each newly-installed target repo. The PR SHALL:

- Add `.github/workflows/openspec-flow.yml` with the current shim template.
- Create the three lifecycle labels (`openspec:go`, `openspec:spec`,
  `openspec:impl`) if they do not already exist.
- Use the branch name `chore/openspec-flow-install`.
- Use the title `chore: install openspec-flow shim`.
- Include in the PR body the link to the install docs, the list of required
  secrets, and a checklist the user can tick before merging.
- Be authored by the App (`openspec-flow[bot]`).

The user opts in by merging the PR. The system SHALL NOT push the shim file
directly to the default branch.

#### Scenario: Install on a fresh repo opens a PR
- **WHEN** the App is installed on a repo with no existing
  `.github/workflows/openspec-flow.yml`
- **THEN** the system SHALL open exactly one PR on branch
  `chore/openspec-flow-install` with the shim file and labels

#### Scenario: Install on a repo that already has the shim is a no-op
- **WHEN** the App is installed on a repo whose default branch already contains
  `.github/workflows/openspec-flow.yml` with a valid `uses:` line
- **THEN** the system SHALL NOT open a PR
- **AND** the system SHALL post no comment

#### Scenario: Install PR is idempotent on retry
- **WHEN** the install handler runs again for the same installation while an
  unmerged install PR already exists
- **THEN** the system SHALL re-use the existing PR (updating its body if the
  template changed) rather than opening a duplicate

### Requirement: Drift detection opens a bump PR when the shim ref is stale

The system SHALL check each installed repo's shim file at most once per day. If
the `@<ref>` in the shim is older than the latest published tag in
`dwmkerr/openspec-flow`, the system SHALL open a pull request that updates the
ref to the latest tag and only that token.

The drift PR SHALL:

- Use branch `chore/openspec-flow-bump-<oldref>-to-<newref>`.
- Use title `chore: bump openspec-flow to <newref>`.
- Include in the body a link to the release notes for the new version.
- Be authored by `openspec-flow[bot]`.

If a drift PR is already open for the same installation, the system SHALL update
the existing PR rather than open a new one.

#### Scenario: Stale shim triggers a bump PR
- **WHEN** the drift check runs and finds the shim pinned to a ref older than the
  latest published tag
- **THEN** the system SHALL open a drift PR updating only the `@<ref>` token

#### Scenario: Up-to-date shim is left alone
- **WHEN** the drift check runs and finds the shim pinned to the latest tag
- **THEN** the system SHALL NOT open a PR

#### Scenario: Existing drift PR is updated, not duplicated
- **WHEN** the drift check runs and an unmerged drift PR already exists for that
  installation
- **THEN** the system SHALL update the existing PR's branch and body to reflect
  the latest target ref rather than opening a second PR

### Requirement: CLI writes or updates the shim without requiring the App

The system SHALL provide a CLI command `npx @dwmkerr/openspec-flow shim` that,
when run inside a repo, writes or updates `.github/workflows/openspec-flow.yml`
to match the current shim template. The command SHALL:

- Detect whether the file exists; if missing, create it.
- If present, replace only the `@<ref>` token, preserving all surrounding content.
- Accept `--ref <tag-or-sha>` to override the target ref.
- Accept `--sha-pin` to resolve the ref to a full commit SHA and pin to that.
- Print a unified diff of the change before writing, and require a `--yes` flag
  or interactive confirmation to write.
- Exit with code 0 on no-op (file already matches), code 1 on user abort, code
  2 on filesystem or network error.

#### Scenario: CLI creates the shim on a fresh repo
- **WHEN** the user runs `npx @dwmkerr/openspec-flow shim --yes` in a repo with
  no shim file
- **THEN** the CLI SHALL create `.github/workflows/openspec-flow.yml` from the
  current template

#### Scenario: CLI bumps the ref on an existing shim
- **WHEN** the user runs `npx @dwmkerr/openspec-flow shim --ref v0.3.0 --yes` in
  a repo whose shim is pinned to `v0.2.0`
- **THEN** the CLI SHALL replace exactly the `@v0.2.0` token with `@v0.3.0` and
  leave all other lines unchanged

#### Scenario: CLI is a no-op when the file already matches
- **WHEN** the user runs the CLI and the shim already matches the target template
- **THEN** the CLI SHALL print "shim is up to date" and exit 0 without writing

### Requirement: Identity flows from the App when installed, falls back otherwise

When the App is installed on a target repo, the reusable workflow SHALL mint an
installation token via `actions/create-github-app-token@v1` using
`OPENSPEC_FLOW_APP_ID` and `OPENSPEC_FLOW_PRIVATE_KEY`. The token SHALL be used
for `actions/checkout`, all `gh` invocations, and `git push`. Commits authored
inside the reusable workflow SHALL set `user.name=openspec-flow[bot]` and
`user.email=<installation-id>+openspec-flow[bot]@users.noreply.github.com`.

When the App is not installed, the reusable workflow SHALL fall back to the
default `GITHUB_TOKEN` and `github-actions[bot]` identity, log a warning that
shim self-update is disabled in this mode, and continue.

#### Scenario: App-installed repo uses bot identity
- **WHEN** the reusable workflow runs in a repo where `OPENSPEC_FLOW_APP_ID` and
  `OPENSPEC_FLOW_PRIVATE_KEY` are populated
- **THEN** all commits SHALL be authored by `openspec-flow[bot]`
- **AND** the token used for git operations SHALL be the installation token

#### Scenario: Repo without the App still runs the agent
- **WHEN** the reusable workflow runs in a repo where `OPENSPEC_FLOW_APP_ID` is
  empty
- **THEN** the workflow SHALL log a single warning line
- **AND** SHALL proceed using `GITHUB_TOKEN` and `github-actions[bot]` identity
- **AND** SHALL not attempt to modify `.github/workflows/openspec-flow.yml`

### Requirement: App permission surface is fixed and documented

The App SHALL request exactly the following repository-level permissions:
`Contents: Read & Write`, `Pull requests: Read & Write`, `Issues: Read & Write`,
`Workflows: Read & Write`, `Actions: Read`, `Checks: Read`. It SHALL subscribe
to the events `issues`, `issue_comment`, `pull_request`,
`pull_request_review_comment`, `installation`, and `installation_repositories`.

Adding a new permission or event subscription SHALL require a new RFC change.

#### Scenario: App registration matches the documented permission set
- **WHEN** an operator registers the production App from `docs/app-setup.md`
- **THEN** the permissions and event subscriptions in the App settings SHALL
  match this requirement exactly

### Requirement: Probot service is not on the critical execution path

The system SHALL service all runtime triggers — issue labelling, PR comments,
PR merge events — from the reusable workflow running on the target repo's
Actions runner. The Probot service, if deployed, SHALL handle only the
`installation.created`, `installation_repositories.added`, and scheduled
drift-check events. The Probot service SHALL NOT clone target repositories
and SHALL NOT execute the Claude agent.

#### Scenario: Spec PR opens without Probot reachable
- **WHEN** the Probot service is offline and a user adds `openspec:go` to an
  issue in a repo where the shim is installed
- **THEN** the spec PR SHALL still be opened by the reusable workflow on the
  target repo's runner

#### Scenario: Install handler is the only Probot-side runtime
- **WHEN** the Probot service receives a webhook other than `installation.*` or
  `installation_repositories.*`
- **THEN** the service SHALL acknowledge with 204 and take no further action
