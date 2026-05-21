# init-command Specification

## ADDED Requirements

### Requirement: `init` is a subcommand of the `openspec-flow` binary

The `openspec-flow` CLI SHALL expose an `init` subcommand registered
on the existing `commander` program shipped by the binary. The
subcommand SHALL be invocable as both `openspec-flow init` (when the
package is installed) and `npx @dwmkerr/openspec-flow init` (when it
is not).

#### Scenario: Subcommand is registered
- **WHEN** `openspec-flow --help` is executed
- **THEN** the output lists `init` among the available subcommands
  with a one-line description

#### Scenario: `npx` invocation works on a clean machine
- **WHEN** `npx @dwmkerr/openspec-flow init --yes` is run inside a
  git repository that has not previously installed openspec-flow
- **THEN** the subcommand runs to completion and exits with code 0

### Requirement: `init` writes a reusable-workflow shim

The `init` subcommand SHALL write a file at
`.github/workflows/openspec-flow.yml` whose body invokes
`dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v1` as a
`uses:` reusable workflow and passes the three required secrets
(`ANTHROPIC_API_KEY`, `OPENSPEC_FLOW_APP_ID`,
`OPENSPEC_FLOW_PRIVATE_KEY`) through.

#### Scenario: Workflow file is created in a clean repo
- **GIVEN** a git repository with no `.github/workflows/openspec-flow.yml`
- **WHEN** `openspec-flow init --yes` runs
- **THEN** the file exists, references the upstream reusable workflow
  at the pinned major version, and declares each of the three required
  secrets

#### Scenario: Workflow file already matches the template
- **GIVEN** the file exists and is byte-identical to the shipped template
- **WHEN** `openspec-flow init --yes` runs
- **THEN** the file is not rewritten and the result for that artefact
  is reported as `unchanged`

### Requirement: `init` writes a commented `.openspec-flow.yaml` stub

The `init` subcommand SHALL write a file at `.openspec-flow.yaml`
containing only YAML comments. The stub SHALL declare the intent
of the file (future configuration knobs) but SHALL NOT define any
schema-validated keys in this slice.

#### Scenario: Config stub is created
- **GIVEN** a repository with no `.openspec-flow.yaml`
- **WHEN** `openspec-flow init --yes` runs
- **THEN** `.openspec-flow.yaml` exists, contains only comment lines
  (lines starting with `#`) and blank lines, and parses as an empty
  YAML document

### Requirement: `init` patches the README between markers

The `init` subcommand SHALL maintain an install block in `README.md`
delimited by HTML comment markers `<!-- openspec-flow:install-start -->`
and `<!-- openspec-flow:install-end -->`. The block SHALL contain the
install instructions shipped by the CLI.

#### Scenario: Markers are absent — block is appended
- **GIVEN** `README.md` exists without either marker
- **WHEN** `openspec-flow init --yes` runs
- **THEN** both markers and the install block are appended to the end
  of `README.md` exactly once

#### Scenario: Markers exist and block is current
- **GIVEN** `README.md` already contains both markers and the block
  between them matches the shipped template
- **WHEN** `openspec-flow init --yes` runs
- **THEN** `README.md` is not modified

#### Scenario: Exactly one marker present — drift
- **GIVEN** `README.md` contains the start marker but not the end
  marker (or vice versa)
- **WHEN** `openspec-flow init --yes` runs without `--force`
- **THEN** the command prints a drift error and exits non-zero

### Requirement: `init` reports the presence of required secrets

`init` SHALL print a presence report for the three required secrets
(`ANTHROPIC_API_KEY`, `OPENSPEC_FLOW_APP_ID`,
`OPENSPEC_FLOW_PRIVATE_KEY`). When the GitHub CLI (`gh`) is
available on `PATH` and authenticated, `init` SHALL run
`gh secret list` once to populate the report. The report SHALL NOT
modify any secret.

#### Scenario: `gh` is available and authenticated
- **GIVEN** `gh` is installed and `gh auth status` succeeds
- **WHEN** `openspec-flow init --yes` runs
- **THEN** the command prints one line per required secret
  (`ANTHROPIC_API_KEY`, `OPENSPEC_FLOW_APP_ID`,
  `OPENSPEC_FLOW_PRIVATE_KEY`) showing presence (`✓`) or absence
  (`✗`) and an instruction for setting any absent secret

#### Scenario: `gh` is not installed
- **GIVEN** `gh` is not on `PATH`
- **WHEN** `openspec-flow init --yes` runs
- **THEN** the command prints a single note that the secret check
  was skipped and continues to completion

#### Scenario: Missing secrets do not fail the command
- **GIVEN** one or more required secrets are absent
- **WHEN** `openspec-flow init --yes` runs
- **THEN** the command still exits with code 0 (assuming no drift)

### Requirement: `init` is idempotent

Running `init` twice in succession against the same repository SHALL
produce no further changes on the second run when no artefact has
drifted.

#### Scenario: Second run is a no-op
- **GIVEN** `openspec-flow init --yes` has completed once in a repo
- **WHEN** `openspec-flow init --yes` is run again with no
  intervening edits
- **THEN** no file is modified and the command exits with code 0

#### Scenario: Drift without `--force` fails
- **GIVEN** any of the three artefacts has been hand-edited so its
  content differs from the shipped template
- **WHEN** `openspec-flow init` is run without `--force`
- **THEN** the command prints which artefacts have drifted and exits
  with a non-zero code, and SHALL NOT overwrite the drifted files

#### Scenario: Drift with `--force` overwrites
- **GIVEN** any of the three artefacts has drifted
- **WHEN** `openspec-flow init --force --yes` is run
- **THEN** the drifted artefacts are overwritten with the shipped
  template and the command exits with code 0

### Requirement: `init` gates prompts on TTY and honours `--yes`

The `init` subcommand SHALL only prompt the user interactively when
`process.stdin.isTTY` is true and the `--yes` flag has not been
passed. When prompts are skipped, every prompt SHALL behave as if
the default answer were chosen.

#### Scenario: Non-TTY invocation skips prompts
- **WHEN** `init` is invoked with stdin piped from another process
  (or any non-TTY context) without the `--yes` flag
- **THEN** the command runs to completion without emitting a prompt
  and uses default answers throughout

#### Scenario: `--yes` skips prompts even on a TTY
- **GIVEN** a TTY-attached shell
- **WHEN** the user runs `openspec-flow init --yes`
- **THEN** no prompt is displayed and default answers are used

### Requirement: `init` prints next-step instructions, not actions

The final stdout block SHALL instruct the user to stage, commit, and
push the generated files themselves. The CLI SHALL NOT invoke `git`
nor open a pull request on the user's behalf in this slice.

#### Scenario: Final block lists git commands
- **WHEN** `init` completes successfully
- **THEN** stdout ends with a numbered list including `git add`,
  `git commit`, and `git push` invocations referencing the three
  artefact paths

#### Scenario: No PR is opened
- **WHEN** `init` runs in any mode (with or without `--yes` /
  `--force`)
- **THEN** no `gh pr create`, `octokit.pulls.create`, or equivalent
  API call SHALL be made

### Requirement: `init` is covered by a smoke test

The repository SHALL include an integration test at
`tests/integration/shim-init.test.ts` that creates a fresh temporary
git repository, runs the `init` subcommand with `--yes`, and asserts
the presence and shape of the three artefacts plus exit code 0.

#### Scenario: Smoke test runs the full subcommand
- **GIVEN** a freshly initialised temporary git repository
- **WHEN** the integration test invokes `openspec-flow init --yes`
- **THEN** the test asserts that all three artefacts exist with the
  expected content and that the process exit code is 0
