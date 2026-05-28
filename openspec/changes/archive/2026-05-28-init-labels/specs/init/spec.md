## ADDED Requirements

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
