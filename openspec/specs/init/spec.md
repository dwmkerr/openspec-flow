# init Specification

## Purpose
The `openspec-flow init` command — the local scaffolder that prepares a repo for openspec-flow: writes the workflow shim, patches a managed README block, reports secret state, and surfaces the label-readiness checklist. OpenSpec scaffolding (the `openspec/` tree, AI-tool selection) is delegated to `openspec init`.
## Requirements
### Requirement: Binary and command surface

The package `@dwmkerr/openspec-flow` SHALL expose a binary named `openspec-flow`. The binary SHALL accept the subcommand `init` with the following flags:

- `--yes` — skip all interactive prompts; accept defaults
- `--force` — overwrite the managed README block when markers are present
- `--path <dir>` — target directory (default: current working directory)
- `--version` — print package version and exit
- `--help` — print usage and exit

#### Scenario: Default invocation in a clean repo

- **WHEN** `npx @dwmkerr/openspec-flow init --yes` runs in a directory containing `openspec/` and no openspec-flow artefacts
- **THEN** the process writes `.github/workflows/openspec-flow.yml` and a managed block in `README.md`
- **AND** exits 0

#### Scenario: Help

- **WHEN** `openspec-flow init --help` runs
- **THEN** the process prints a help summary including all listed flags
- **AND** exits 0

### Requirement: Workflow file write

`init` SHALL write `.github/workflows/openspec-flow.yml` containing the reusable-workflow stub defined in the `rfc-shim-architecture` change (Decision 5). The `uses:` line SHALL reference the published reusable workflow at a ref tied to the installed CLI's version.

#### Scenario: First run writes the workflow

- **WHEN** `init --yes` runs and `.github/workflows/openspec-flow.yml` does not exist
- **THEN** the file is created with the rendered workflow template

#### Scenario: Re-run on a matching workflow is a no-op

- **WHEN** `init --yes` runs and the existing workflow file is byte-identical to the current template
- **THEN** the file is not modified
- **AND** stdout includes `already initialised`
- **AND** exit code is 0

#### Scenario: Re-run on a hand-edited workflow warns and does not overwrite

- **WHEN** `init --yes` runs and the existing workflow file differs from the current template
- **THEN** the file is not modified
- **AND** stdout includes a warning naming the file
- **AND** exit code is 0

#### Scenario: Force overwrites a hand-edited workflow

- **WHEN** `init --yes --force` runs and the existing workflow file differs from the current template
- **THEN** the file is overwritten with the current template
- **AND** exit code is 0

### Requirement: README managed-block patch

`init` SHALL inject content between the marker pair `<!-- openspec-flow init-start -->` and `<!-- openspec-flow init-end -->`. The model is three-state and intentionally simple:

- **No markers** — `init` appends the marker pair and managed content to `README.md` (or creates a minimal `README.md` if one does not exist).
- **Markers present** — `init` leaves the file alone. Once injected, the user owns the section.
- **`--force`** — `init` overwrites the content between the markers with the current managed content.

Content outside the markers SHALL NOT be modified.

#### Scenario: README absent — created with managed block

- **WHEN** `init --yes` runs and `README.md` does not exist
- **THEN** a `README.md` is created containing a `# <repo-name>` heading followed by the marker pair and managed content

#### Scenario: README present without markers — block appended

- **WHEN** `init --yes` runs and `README.md` exists without the marker pair
- **THEN** the marker pair and managed content are appended to `README.md` separated from existing content by a blank line
- **AND** content above the appended block is byte-identical to the file's previous content

#### Scenario: Markers present — leave alone by default

- **WHEN** `init --yes` runs and `README.md` contains the marker pair
- **THEN** `README.md` is not modified
- **AND** exit code is 0

#### Scenario: Force overwrites the managed block

- **WHEN** `init --yes --force` runs and `README.md` contains the marker pair
- **THEN** content between the markers is replaced with the current managed content
- **AND** content outside the markers is byte-identical to the file's previous content

### Requirement: Secret-state reporting

`init` SHALL report the presence of the `ANTHROPIC_API_KEY` GitHub Actions secret when `gh` is on `PATH` and the working directory resolves to a GitHub remote. `init` SHALL NEVER write a secret value, prompt for one, or transmit one. The probe SHALL always run when the prerequisites are met — there is no opt-out flag.

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

### Requirement: OpenSpec scaffold hard gate

`init` SHALL require an `openspec/` directory at the target root. When `openspec/` is absent, `init` SHALL print instructions referencing `npx @fission-ai/openspec init` and exit non-zero without writing any file. `init` SHALL NOT install or invoke OpenSpec — that scaffold is the user's responsibility and OpenSpec's CLI owns AI-tool selection + skill installation.

#### Scenario: Missing openspec/ exits without writing

- **WHEN** `init --yes` runs in a repo with no `openspec/` directory
- **THEN** stdout contains a line referencing `npx @fission-ai/openspec init`
- **AND** no workflow, README, or other artefact is written
- **AND** exit code is 1

#### Scenario: Present openspec/ proceeds normally

- **WHEN** `init --yes` runs in a repo with an existing `openspec/` directory
- **THEN** the workflow and README block are written

### Requirement: User-facing next-steps instructions

`init` SHALL print, on success, a set of stdout instructions covering at minimum: (1) review the diff, (2) commit on a feature branch, (3) push and open a PR titled `chore: openspec-flow setup`, (4) verify required secrets are set before merging.

#### Scenario: Success prints next-steps block

- **WHEN** `init --yes` completes successfully
- **THEN** stdout contains lines covering review, commit, push, and PR-open
- **AND** the PR title `chore: openspec-flow setup` appears verbatim in the instructions

### Requirement: Exit codes

`init` SHALL use the following exit codes:

- `0` — success (including no-op re-runs)
- `1` — missing `openspec/` scaffold (or other unexpected error)
- `2` — non-TTY invocation without `--yes`

#### Scenario: Success exits 0

- **WHEN** `init --yes` completes any successful path including no-op
- **THEN** exit code is 0

#### Scenario: Missing openspec exits 1

- **WHEN** `init --yes` runs in a repo without `openspec/`
- **THEN** exit code is 1

#### Scenario: Non-TTY without --yes exits 2

- **WHEN** `init` runs without a TTY and without `--yes`
- **THEN** exit code is 2

### Requirement: Label readiness check is read-only and prints create commands

`init` SHALL check whether the three contract labels (`openspec:go`, `openspec:spec`, `openspec:impl`) exist on the target repo, using a read-only `gh label list` when `gh` is on `PATH` and a GitHub remote resolves. `init` SHALL NOT create, edit, or delete any label. For each missing label, `init` SHALL print the exact `gh label create` command — including the canonical color and description — for the user to run.

The canonical labels are:

- `openspec:go` — color `0969da` — "Trigger: start or re-run openspec-flow"
- `openspec:spec` — color `8250df` — "Spec PR raised by openspec-flow"
- `openspec:impl` — color `1a7f37` — "Implementation PR raised by openspec-flow"

#### Scenario: Reports present labels

- **WHEN** `init --yes` runs with `gh` available, a GitHub remote, and all three contract labels already present
- **THEN** the output marks the labels as present
- **AND** no `gh label create` command is printed

#### Scenario: Prints create commands for missing labels

- **WHEN** `init --yes` runs with `gh` available, a GitHub remote, and `openspec:go` absent
- **THEN** the output includes the verbatim command `gh label create "openspec:go" --color 0969da --description "Trigger: start or re-run openspec-flow"`
- **AND** no label is created by `init`

#### Scenario: Skips the check when gh is unavailable

- **WHEN** `init --yes` runs and `gh` is not on `PATH` (or no GitHub remote resolves)
- **THEN** the label check is skipped with a one-line reason
- **AND** exit code is 0

#### Scenario: init never writes labels

- **WHEN** `init` runs in any mode without the (future) `--github-labels` flag
- **THEN** no `gh label create`/`edit`/`delete` subprocess is spawned by `init`

