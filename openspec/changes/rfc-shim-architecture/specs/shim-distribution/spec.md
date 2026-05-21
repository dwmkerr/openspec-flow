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

### Requirement: `init` CLI writes or updates the shim without requiring the App

The system SHALL provide a CLI command `npx @dwmkerr/openspec-flow init` that,
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

#### Scenario: `init` creates the shim on a fresh repo
- **WHEN** the user runs `npx @dwmkerr/openspec-flow init --yes` in a repo with
  no shim file
- **THEN** the CLI SHALL create `.github/workflows/openspec-flow.yml` from the
  current template

#### Scenario: `init` bumps the ref on an existing shim
- **WHEN** the user runs `npx @dwmkerr/openspec-flow init --ref v0.3.0 --yes`
  in a repo whose shim is pinned to `v0.2.0`
- **THEN** the CLI SHALL replace exactly the `@v0.2.0` token with `@v0.3.0` and
  leave all other lines unchanged

#### Scenario: `init` is a no-op when the file already matches
- **WHEN** the user runs the CLI and the shim already matches the target template
- **THEN** the CLI SHALL print "shim is up to date" and exit 0 without writing

### Requirement: `init` reports required secret state without writing secret values

The `init` command SHALL inspect the target repo's GitHub Actions secret set
(via `gh api`) and report on the following secrets without ever printing or
writing their values:

- `ANTHROPIC_API_KEY` — required. Reused under its canonical name; the system
  SHALL NOT rename it to an `OPENSPEC_FLOW_`-prefixed variant.
- `OPENSPEC_FLOW_APP_ID` — optional. Required only for App-derived identity.
- `OPENSPEC_FLOW_PRIVATE_KEY` — optional. Required only for App-derived identity.

The CLI SHALL print, for each secret, one of `present`, `missing`, or
`unknown (no `repo` scope on token)`. When `ANTHROPIC_API_KEY` is missing the
CLI SHALL print a remediation line linking to the install docs and SHALL exit
non-zero unless invoked with `--ignore-missing-secrets`. The CLI SHALL NOT
write any secret value to the repo, to the shim, or to `.openspec-flow.yaml`.

#### Scenario: `init` reports a missing required secret
- **WHEN** the user runs `init` in a repo where `ANTHROPIC_API_KEY` is not set
- **THEN** the CLI SHALL print `ANTHROPIC_API_KEY: missing` and a remediation link
- **AND** SHALL exit non-zero unless `--ignore-missing-secrets` was passed

#### Scenario: `init` does not rename third-party secrets
- **WHEN** `init` writes or updates the shim
- **THEN** the shim's `secrets:` block SHALL reference `ANTHROPIC_API_KEY` by
  its canonical name and SHALL NOT introduce an `OPENSPEC_FLOW_ANTHROPIC*` alias

### Requirement: `init` SHALL support a local `.openspec-flow.yaml` for non-secret configuration

The `init` command SHALL, when invoked with `--write-config` (or its interactive equivalent), write a file `.openspec-flow.yaml` at the repo root capturing non-secret local configuration (e.g. model overrides, opt-out flags). The file SHALL NOT contain secret values. The reusable workflow and the CLI SHALL read this file at runtime when present and SHALL ignore unknown top-level keys for forward compatibility.

The exact schema is specified in the follow-up `shim-init` change; this RFC
only fixes the file's location, its no-secrets rule, and the read-side
forward-compatibility contract.

#### Scenario: Secret values never land in `.openspec-flow.yaml`
- **WHEN** `init` writes `.openspec-flow.yaml`
- **THEN** the file SHALL contain no key whose value is or could be a secret
  (no API keys, no private keys, no tokens)

#### Scenario: Unknown keys in `.openspec-flow.yaml` are ignored
- **WHEN** the reusable workflow loads `.openspec-flow.yaml` and encounters a
  top-level key it does not recognise
- **THEN** the workflow SHALL log the unknown key at info level and continue

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
