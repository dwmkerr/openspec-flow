## MODIFIED Requirements

### Requirement: Binary and command surface

The package `@dwmkerr/openspec-flow` SHALL expose a binary named `openspec-flow` built on a hierarchical command parser. The top-level `--help` SHALL list the available commands (`install`, `uninstall`, `dispatch`, `handle`) without dumping every flag. Each command SHALL provide its own `--help`. The binary SHALL support `--version`. An unknown command or a missing required option SHALL exit non-zero with a clear message.

The user-facing commands are `install` and `uninstall`, each accepting:

- `--yes` — skip all interactive prompts; accept defaults
- `--force` — `install`: overwrite the managed README block when markers are present; `uninstall`: remove a workflow file that has diverged from the template
- `--path <dir>` — target directory (default: current working directory)

`--version` and `--help` are available at every level.

#### Scenario: install in a clean repo

- **WHEN** `openspec-flow install --yes` runs in a directory containing `openspec/` and no openspec-flow artefacts
- **THEN** the process writes `.github/workflows/openspec-flow.yml` and a managed block in `README.md`
- **AND** exits 0

#### Scenario: Top-level help lists commands

- **WHEN** `openspec-flow --help` runs
- **THEN** the output lists `install`, `uninstall`, `dispatch`, and `handle`
- **AND** exits 0

#### Scenario: Per-command help

- **WHEN** `openspec-flow install --help` runs
- **THEN** the output shows the `install` flags (`--yes`, `--force`, `--path`)
- **AND** exits 0

#### Scenario: Unknown command exits non-zero

- **WHEN** `openspec-flow bogus` runs
- **THEN** stderr names the unknown command
- **AND** exit code is non-zero
