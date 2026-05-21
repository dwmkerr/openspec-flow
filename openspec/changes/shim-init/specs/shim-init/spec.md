## ADDED Requirements

### Requirement: Binary and command surface

The package `@dwmkerr/openspec-flow` SHALL expose a binary named `openspec-flow`. The binary SHALL accept the subcommand `init` with the following flags:

- `--yes` — skip all interactive prompts; accept defaults
- `--force` — overwrite hand-edited managed files
- `--no-secrets-check` — skip the `gh secret list` probe
- `--path <dir>` — target directory (default: current working directory)
- `--version` — print package version and exit
- `--help` — print usage and exit

#### Scenario: Default invocation in a clean repo

- **WHEN** `npx @dwmkerr/openspec-flow init --yes` runs in a directory containing a git repo with no openspec-flow artefacts
- **THEN** the process writes `.github/workflows/openspec-flow.yml`, `.openspec-flow.yaml`, and a managed block in `README.md`
- **AND** exits 0

#### Scenario: Help

- **WHEN** `openspec-flow init --help` runs
- **THEN** the process prints a help summary including all listed flags
- **AND** exits 0

### Requirement: Shim workflow file write

`init` SHALL write `.github/workflows/openspec-flow.yml` containing the reusable-workflow stub defined in the `rfc-shim-architecture` change (Decision 5). The `uses:` line SHALL reference the published reusable workflow at a versioned tag matching the installed CLI's major.minor version.

#### Scenario: First run writes the shim

- **WHEN** `init --yes` runs and `.github/workflows/openspec-flow.yml` does not exist
- **THEN** the file is created with the rendered shim template
- **AND** the `uses:` line ends with `@v<major>.<minor>.<patch>` matching the CLI version

#### Scenario: Re-run on a matching shim is a no-op

- **WHEN** `init --yes` runs and the existing shim file's content hash matches the current template
- **THEN** the file is not modified
- **AND** stdout includes `already initialised`
- **AND** exit code is 0

#### Scenario: Re-run on a hand-edited shim warns and does not overwrite

- **WHEN** `init --yes` runs and the existing shim file's content hash matches no known template version
- **THEN** the file is not modified
- **AND** stdout includes a warning naming the file
- **AND** exit code is 0

#### Scenario: Force overwrites a hand-edited shim

- **WHEN** `init --yes --force` runs and the existing shim file's content hash matches no known template version
- **THEN** the file is overwritten with the current template
- **AND** exit code is 0

### Requirement: Config stub write

`init` SHALL write `.openspec-flow.yaml` at the project root containing a commented stub. The stub SHALL parse as valid YAML and SHALL be a no-op for the runtime (every field commented out).

#### Scenario: First run writes the config stub

- **WHEN** `init --yes` runs and `.openspec-flow.yaml` does not exist
- **THEN** the file is created
- **AND** parses as valid YAML
- **AND** contains no uncommented keys

#### Scenario: Re-run does not modify an existing config

- **WHEN** `init --yes` runs and `.openspec-flow.yaml` exists with any content
- **THEN** the file is not modified
- **AND** exit code is 0

### Requirement: README managed-block patch

`init` SHALL patch `README.md` between the marker pair `<!-- openspec-flow:install-start -->` and `<!-- openspec-flow:install-end -->`. Content outside the markers SHALL NOT be modified.

#### Scenario: First run appends the block

- **WHEN** `init --yes` runs and `README.md` does not contain the marker pair
- **THEN** the marker pair and managed content are appended to `README.md` separated from existing content by a blank line
- **AND** content above the appended block is byte-identical to the file's previous content

#### Scenario: README missing creates a minimal file

- **WHEN** `init --yes` runs and `README.md` does not exist
- **THEN** a `README.md` is created containing a project-level `# <repo-name>` heading followed by the managed block

#### Scenario: Re-run replaces only the managed block

- **WHEN** `init --yes` runs and `README.md` contains the marker pair
- **THEN** content between the markers is replaced with the current managed content
- **AND** content outside the markers is byte-identical to the file's previous content

#### Scenario: Deleted markers are not re-injected without force

- **WHEN** `init --yes` runs and `README.md` exists without the marker pair and `init` has previously written the block
- **THEN** `README.md` is not modified
- **AND** stdout includes a warning that the user has taken over the README section
- **AND** exit code is 0

#### Scenario: Force re-appends after marker deletion

- **WHEN** `init --yes --force` runs and `README.md` exists without the marker pair
- **THEN** the marker pair and managed content are appended to `README.md`

### Requirement: Secret-state reporting

`init` SHALL report the presence of `ANTHROPIC_API_KEY`, `OPENSPEC_FLOW_APP_ID`, and `OPENSPEC_FLOW_PRIVATE_KEY` as GitHub Actions secrets when `gh` is on `PATH` and the working directory resolves to a GitHub remote. `init` SHALL NEVER write a secret value, prompt for one, or transmit one.

#### Scenario: Reports presence when gh is available

- **WHEN** `init --yes` runs and `gh` is on PATH and a GitHub remote is configured and `ANTHROPIC_API_KEY` is set
- **THEN** stdout contains a line indicating `ANTHROPIC_API_KEY` is present

#### Scenario: Reports absence when gh is available

- **WHEN** `init --yes` runs and `gh` is on PATH and a GitHub remote is configured and `ANTHROPIC_API_KEY` is unset
- **THEN** stdout contains a line indicating `ANTHROPIC_API_KEY` is missing

#### Scenario: Skips check when gh is missing

- **WHEN** `init --yes` runs and `gh` is not on PATH
- **THEN** stdout contains a line indicating the secret check was skipped
- **AND** exit code is 0

#### Scenario: Skips check on explicit flag

- **WHEN** `init --yes --no-secrets-check` runs
- **THEN** no `gh` subprocess is spawned
- **AND** stdout does not include secret presence or absence lines

### Requirement: Idempotent and ordered file writes

`init` SHALL determine the planned set of write actions before performing any write. If all planned actions are no-ops, `init` SHALL exit 0 having modified no files on disk.

#### Scenario: Full no-op re-run

- **WHEN** `init --yes` runs in a fully-initialised repo
- **THEN** filesystem `mtime` of every artefact is unchanged
- **AND** exit code is 0

### Requirement: TTY and non-interactive handling

`init` SHALL prompt the user for confirmation before any destructive action (overwriting under `--force`, appending to a non-empty README) only when `process.stdout.isTTY` is true and `--yes` is not passed. When `process.stdout.isTTY` is false and `--yes` is not passed, `init` SHALL exit non-zero with a message instructing the user to pass `--yes`.

#### Scenario: Non-TTY without --yes fails fast

- **WHEN** `init` runs with stdin/stdout not attached to a TTY and `--yes` is absent
- **THEN** stderr contains `refusing to run non-interactively without --yes`
- **AND** exit code is non-zero

#### Scenario: TTY with --yes does not prompt

- **WHEN** `init --yes` runs in a TTY
- **THEN** no interactive prompts are shown

### Requirement: OpenSpec scaffold advisory

`init` SHALL detect whether the target directory contains an `openspec/` directory at its root. When `openspec/` is absent, `init` SHALL print a single advisory line referencing `npx @fission-ai/openspec init` and continue. `init` SHALL NOT install or invoke OpenSpec in this slice.

#### Scenario: Missing openspec/ prints advisory

- **WHEN** `init --yes` runs in a repo with no `openspec/` directory
- **THEN** stdout contains a line referencing `npx @fission-ai/openspec init`
- **AND** the shim, config, and README block are still written
- **AND** exit code is 0

#### Scenario: Present openspec/ does not print advisory

- **WHEN** `init --yes` runs in a repo with an existing `openspec/` directory
- **THEN** stdout does not contain the OpenSpec advisory line

### Requirement: User-facing next-steps instructions

`init` SHALL print, on success, a set of stdout instructions covering at minimum: (1) review the diff, (2) commit on a feature branch, (3) push and open a PR titled `chore: openspec-flow setup`, (4) verify required secrets are set before merging.

#### Scenario: Success prints next-steps block

- **WHEN** `init --yes` completes successfully
- **THEN** stdout contains lines covering review, commit, push, and PR-open
- **AND** the PR title `chore: openspec-flow setup` appears verbatim in the instructions

### Requirement: Exit codes

`init` SHALL use the following exit codes:

- `0` — success (including no-op re-runs and advisory paths)
- `1` — unexpected error
- `2` — non-TTY invocation without `--yes`

#### Scenario: Success exits 0

- **WHEN** `init --yes` completes any successful path including no-op
- **THEN** exit code is 0

#### Scenario: Non-TTY without --yes exits 2

- **WHEN** `init` runs without a TTY and without `--yes`
- **THEN** exit code is 2
