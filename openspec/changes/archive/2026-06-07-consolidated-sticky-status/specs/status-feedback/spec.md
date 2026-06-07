# status-feedback Specification Delta

## ADDED Requirements

### Requirement: Issue carries one consolidated lifecycle sticky comment

For every issue handled by openspec-flow there SHALL be exactly one bot-authored sticky comment on the issue that represents the current state of the flow. The comment SHALL be identified by the lookup marker `<!-- openspec-flow:sticky issue=<n> -->` and SHALL carry the current state as a base64-encoded JSON payload in a separate `<!-- openspec-flow:sticky-state … -->` marker rendered immediately after the lookup marker.

The comment SHALL contain:

- The bolded title `**openspec-flow**`.
- A single descriptive headline that answers "where am I + what do I do next" in plain English.
- A two-row table: `Spec` and `Implementation`. Each row's `Status` column reflects the phase's current substate.
- A right-aligned `<sub>` footer with discreet links to the openspec-flow repo and docs.

#### Scenario: Single sticky per issue

- **GIVEN** a webhook for `issues.labeled` with `openspec:go` arrives on an issue
- **WHEN** any writer (bot pre-gate, workflow handler) calls `mutateLifecycleSticky` for that issue
- **THEN** the lookup marker `<!-- openspec-flow:sticky issue=<n> -->` is found-or-created exactly once
- **AND** the state marker is regenerated to reflect the post-mutation state

#### Scenario: Embedded state survives round-trip

- **GIVEN** a sticky exists with a known state
- **WHEN** any writer reads the comment body
- **THEN** `parseStateFromBody` returns the same state object

### Requirement: Sticky verbs are `preparing` / `creating` / `iterating`

The renderer SHALL use exactly three verbs to describe in-flight phase activity:

- `preparing` — webhook acknowledged; runner has not yet started; no run id available.
- `creating` — the agent is creating the artifact (spec or implementation) for the first time.
- `iterating` — the agent is re-running because `openspec:go` was re-applied on an existing PR.

The verbs SHALL appear in both the headline (`openspec-flow is <verb>ing …`) and the appropriate row of the table.

#### Scenario: Pre-gate state shows preparing

- **WHEN** the bot renders the sticky in the pre-gate window (no run id known)
- **THEN** the headline reads `openspec-flow is preparing to create the specification.`
- **AND** the Spec row reads `preparing`

#### Scenario: Active run shows the verb + workflow link in the row

- **GIVEN** the workflow is in flight with run id 234 and url `<url>`
- **WHEN** the renderer is called with `spec: { kind: "creating", run: { number: 234, url } }`
- **THEN** the headline reads `openspec-flow is creating the specification.`
- **AND** the Spec row reads `creating in [workflow #234](<url>)`

### Requirement: PR references render as explicit markdown links

Every reference to a PR in the sticky body (table row, headline) SHALL render as `[#<n>](https://github.com/<owner>/<repo>/pull/<n>)`. The renderer SHALL receive `repo: { owner, name }` on the state object so URLs can be constructed.

#### Scenario: Spec PR reference is a hyperlink

- **GIVEN** `repo: { owner: "o", name: "r" }` and `spec: { kind: "pr-open", prNumber: 137 }`
- **WHEN** the sticky is rendered
- **THEN** the body contains `[#137](https://github.com/o/r/pull/137)`

### Requirement: Headline tells the user what to do next

For each terminal-awaiting state (PR open without a run active), the headline SHALL include the next action the user is expected to take. For active states, the headline SHALL describe what openspec-flow is doing. For the terminal completed state, the headline SHALL be `Completed.`. For failure states, the headline SHALL begin with `⚠️ Run failed during <phase>` followed by the reason and the recovery instruction.

#### Scenario: Spec PR awaiting review headline

- **GIVEN** `spec: { kind: "pr-open", prNumber: 137 }` and `implementation: { kind: "not-started" }`
- **WHEN** the sticky is rendered
- **THEN** the headline includes `Awaiting review of spec PR [#137]`
- **AND** the headline includes `Merge it to trigger the implementation, or comment and apply the `openspec:go` label on the PR to iterate.`

#### Scenario: Implementation PR awaiting review headline

- **GIVEN** `implementation: { kind: "pr-open", prNumber: 138 }` and `spec: { kind: "pr-merged", … }`
- **WHEN** the sticky is rendered
- **THEN** the headline includes `Merge it to close this issue, or comment and apply the `openspec:go` label on the PR to iterate.`

#### Scenario: Failure headline carries warning sigil and recovery instruction

- **GIVEN** a failure with phase `implementation` and reason `git push rejected`
- **WHEN** the sticky is rendered
- **THEN** the headline begins with `⚠️ Run failed during implementation`
- **AND** the headline ends with `Add the \`openspec:go\` label to retry once the cause is fixed.`

### Requirement: Probot adapter pre-gate seeds and advances the lifecycle sticky

For every actionable lifecycle intent (`create-spec` / `iterate-spec` / `iterate-impl` / `create-impl`) the Probot adapter SHALL call `mutateLifecycleSticky` on the originating issue BEFORE evaluating the `OPENSPEC_FLOW_DISPATCH_MODE` gate. The mutation SHALL advance the appropriate phase row to reflect the new intent (`preparing` for create-*, `pr-iterating` for iterate-*, advance spec to `pr-merged` and seed implementation as `preparing` for create-impl).

#### Scenario: create-spec seeds the spec row as preparing

- **WHEN** the bot processes `issues.labeled` with `openspec:go` (intent `create-spec`)
- **THEN** the issue's lifecycle sticky is upserted with `spec: { kind: "preparing" }`

#### Scenario: create-impl pre-gate marks spec merged and seeds implementation

- **WHEN** the bot processes `pull_request.closed` (merged) with `openspec:spec` (intent `create-impl`)
- **THEN** the issue's lifecycle sticky is upserted with `spec: { kind: "pr-merged", prNumber: <spec PR n> }` and `implementation: { kind: "preparing" }`

### Requirement: Workflow handlers mutate the lifecycle sticky at state transitions

The `create-spec`, `create-impl`, and `finalize-impl` handlers SHALL each call `mutateLifecycleSticky` at the appropriate state transitions:

- `create-spec` — when the spec PR opens, advance `spec` to `pr-open`.
- `create-impl` — when the impl PR opens, advance `spec` to `pr-merged` (if not already) and `implementation` to `pr-open`. On handler failure, advance `implementation` to `failed` and overlay `failure: { phase: "implementation", reason }`.
- `finalize-impl` — when the impl PR merges, advance `implementation` to `pr-merged` (completing the flow).

#### Scenario: create-spec advances Spec to pr-open

- **WHEN** the spec PR opens for issue 42 with PR number 137
- **THEN** the sticky on issue 42 is mutated to `spec: { kind: "pr-open", prNumber: 137 }`

#### Scenario: create-impl failure marks implementation as failed

- **WHEN** the create-impl handler throws after the spec PR was merged
- **THEN** the sticky is mutated to `implementation: { kind: "failed" }` and `failure: { phase: "implementation", reason: <message> }`

#### Scenario: finalize-impl mutates to terminal completed

- **WHEN** the impl PR merges for issue 42
- **THEN** the sticky is mutated to `implementation: { kind: "pr-merged", prNumber: <impl PR n> }`
- **AND** the headline reads `Completed.`
