## ADDED Requirements

### Requirement: Spec PR body uses a non-auto-closing issue reference

The handler SHALL render the spec PR body so that it references the
originating issue with `Refs #<n>.` and SHALL NOT include any of
GitHub's auto-close keywords (`close[sd]`, `fix(es|ed)`,
`resolve[sd]`) followed by the originating issue number. The
auto-maintained HTML metadata block remains the canonical linkage and
is unchanged.

#### Scenario: Spec PR body contains Refs, not Closes
- **WHEN** the handler renders the spec PR body for issue #42
- **THEN** the body contains the substring `Refs #42.`
- **AND** the body does NOT contain any of `Closes #42`, `Fixes #42`,
  or `Resolves #42` (case-insensitive)

#### Scenario: Merging a spec PR does not auto-close the issue
- **GIVEN** the handler has opened a spec PR for issue #42 with the
  body produced by `buildSpecPrBody`
- **WHEN** that spec PR merges into the default branch
- **THEN** issue #42 remains open (GitHub does not auto-close it
  because the body contains no auto-close keyword for #42)
