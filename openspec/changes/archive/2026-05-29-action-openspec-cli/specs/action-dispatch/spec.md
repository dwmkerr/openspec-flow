## ADDED Requirements

### Requirement: Runner provisions the openspec CLI

The reusable workflow SHALL install the Fission `openspec` CLI on the runner before dispatching, so handlers that shell out to it (`openspec new change`, `openspec validate`, `openspec archive`) succeed. The openspec CLI is distinct from the openspec-flow build and from the target repo's committed `.claude/skills/openspec-*` skills.

#### Scenario: openspec CLI available to the handler

- **WHEN** the reusable workflow runs on a fresh runner and dispatches an actionable intent
- **THEN** the `openspec` CLI is on PATH before `openspec-flow dispatch` runs
- **AND** the `create-spec` handler's `openspec` precondition passes

#### Scenario: Precondition message names the correct package

- **WHEN** the openspec CLI precondition fails
- **THEN** the error message references `@fission-ai/openspec`
