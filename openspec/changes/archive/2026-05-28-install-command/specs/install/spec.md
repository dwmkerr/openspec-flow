## MODIFIED Requirements

### Requirement: Binary and command surface

The package `@dwmkerr/openspec-flow` SHALL expose a binary named `openspec-flow`. The binary SHALL accept the subcommands `install` and `uninstall`, each with the following flags:

- `--yes` — skip all interactive prompts; accept defaults
- `--force` — `install`: overwrite the managed README block when markers are present; `uninstall`: remove a workflow file that has diverged from the template
- `--path <dir>` — target directory (default: current working directory)
- `--version` — print package version and exit
- `--help` — print usage and exit

#### Scenario: install in a clean repo

- **WHEN** `openspec-flow install --yes` runs in a directory containing `openspec/` and no openspec-flow artefacts
- **THEN** the process writes `.github/workflows/openspec-flow.yml` and a managed block in `README.md`
- **AND** exits 0

#### Scenario: Help

- **WHEN** `openspec-flow install --help` runs
- **THEN** the process prints a help summary including the `install` and `uninstall` subcommands
- **AND** exits 0

## ADDED Requirements

### Requirement: uninstall removes openspec-flow artefacts

`openspec-flow uninstall` SHALL be the inverse of `install`. It SHALL remove `.github/workflows/openspec-flow.yml` when that file matches the current template, and SHALL strip the managed README block between the marker pair while leaving all surrounding content byte-identical. When the workflow file has diverged from the template, `uninstall` SHALL leave it in place and warn, unless `--force` is passed. `uninstall` SHALL print `gh label delete` commands for the contract labels and SHALL NOT delete labels itself. When no openspec-flow artefacts are present, `uninstall` SHALL report that and exit 0.

#### Scenario: Removes shim and strips README block

- **WHEN** `uninstall --yes` runs in a repo where `install` previously wrote the workflow and README block
- **THEN** `.github/workflows/openspec-flow.yml` is deleted
- **AND** the managed block is removed from `README.md`
- **AND** content outside the markers is byte-identical to before the block was added

#### Scenario: Diverged workflow preserved without force

- **WHEN** `uninstall --yes` runs and the workflow file differs from the current template
- **THEN** the workflow file is not removed
- **AND** stdout warns and suggests `--force`
- **AND** exit code is 0

#### Scenario: Force removes a diverged workflow

- **WHEN** `uninstall --yes --force` runs and the workflow file differs from the current template
- **THEN** the workflow file is deleted

#### Scenario: Prints label delete commands, never deletes

- **WHEN** `uninstall --yes` runs
- **THEN** stdout includes `gh label delete "openspec:go" --yes` (and the same for `openspec:spec`, `openspec:impl`)
- **AND** no label is deleted by `uninstall`

#### Scenario: Nothing to uninstall

- **WHEN** `uninstall --yes` runs in a repo with no openspec-flow artefacts
- **THEN** stdout reports nothing to uninstall
- **AND** exit code is 0
