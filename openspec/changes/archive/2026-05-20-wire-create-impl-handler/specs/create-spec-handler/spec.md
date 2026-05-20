# create-spec-handler Specification

## ADDED Requirements

### Requirement: Spec handler invokes the impl handler when chained mode is enabled

The `create-spec` handler SHALL invoke `handleCreateImpl` with
`mode: "chained"` after a successful spec PR open whenever
`OPENSPEC_FLOW_CHAINED_MODE` is set to `true`. The invocation
SHALL be wrapped in its own try/catch so a chained-mode impl
failure does not roll back the successful spec PR.

#### Scenario: Spec PR opens, chained mode triggers impl
- **GIVEN** `OPENSPEC_FLOW_CHAINED_MODE=true`
- **WHEN** `handleCreateSpec` finishes opening the spec PR
- **THEN** `handleCreateImpl` is invoked with `mode: "chained"`,
  `specPrNumber`, `specBranch`, `changeName`, and `issueNumber`
  already populated

#### Scenario: Chained impl failure does not affect spec PR
- **GIVEN** chained mode triggers `handleCreateImpl`
- **WHEN** the impl handler throws
- **THEN** the spec PR remains open and the failure surfaces as a
  separate visible comment on the originating issue
