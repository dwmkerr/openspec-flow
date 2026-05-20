# test-fixtures Specification

## Purpose
TBD - created by archiving change eyes-ack-and-fixture-cleanup. Update Purpose after archive.
## Requirements
### Requirement: Every fixture carries the test:fixture label

Each issue or PR created by a script under `tests/scripts/` SHALL be
labelled `test:fixture` at creation time, in addition to any
scenario-scoped label (e.g. `test:create-issue`). The label SHALL be
created with color `d73a4a` and description
`Test artefact — safe to delete`.

#### Scenario: Smoke test creates a fixture issue
- **WHEN** a script under `tests/scripts/` creates an issue via the
  shared `create_fixture_issue` helper
- **THEN** the issue carries both the scenario label and
  `test:fixture`

### Requirement: make test-cleanup deletes every test:fixture artefact

`make test-cleanup` SHALL delete every issue (regardless of state)
that carries `test:fixture` and SHALL close (with `--delete-branch`)
every PR that carries `test:fixture`. The target SHALL exit 0 when
no artefacts match.

#### Scenario: Cleanup with matching fixtures
- **WHEN** the user runs `make test-cleanup` and the repo has issues
  or PRs labelled `test:fixture`
- **THEN** each matching issue is deleted and each matching PR is
  closed with its branch deleted

#### Scenario: Cleanup with no matching fixtures
- **WHEN** the user runs `make test-cleanup` and the repo has no
  issues or PRs labelled `test:fixture`
- **THEN** the target exits 0 with a "nothing to clean" summary

### Requirement: Cleanup is idempotent

Running `make test-cleanup` twice in a row SHALL be safe — the second
run finds nothing matching and exits 0.

#### Scenario: Cleanup is run twice
- **GIVEN** `make test-cleanup` has already deleted all fixtures
- **WHEN** the user runs `make test-cleanup` again
- **THEN** the target exits 0 and reports nothing was deleted

