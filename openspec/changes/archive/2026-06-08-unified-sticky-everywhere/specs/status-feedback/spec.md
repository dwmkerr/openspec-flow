# status-feedback Specification Delta

## ADDED Requirements

### Requirement: Lifecycle sticky mirrors to every relevant surface

For every actionable transition, the writer SHALL call `mutateLifecycleStickyEverywhere` with the originating issue number plus every currently-open phase PR number. The renderer SHALL be invoked once per surface, producing identical body content modulo audience tag and lookup marker. State payload SHALL be identical across surfaces (base64 JSON in a hidden HTML comment).

#### Scenario: create-spec opens spec PR — sticky mirrors to issue + new PR

- **WHEN** the create-spec handler opens spec PR #137 for issue #42
- **THEN** the sticky body on issue #42 carries `Specification | PR #137 - open`
- **AND** the sticky body on PR #137 carries the same content prefixed with `Tracked on issue [#42](...) →`

#### Scenario: create-impl opens impl PR — sticky mirrors to issue + both PRs

- **WHEN** the create-impl handler opens impl PR #138 (spec PR #137 already merged)
- **THEN** the sticky is upserted on issue #42, spec PR #137, AND impl PR #138
- **AND** each carries the same row table (Spec: merged; Implementation: PR #138 open)

### Requirement: PR variants carry a tracked-on-issue header

Sticky bodies rendered with `audience: "pr"` SHALL begin with a blockquote line: `> Tracked on issue [#N](https://github.com/<owner>/<repo>/issues/N) →`. Issue variants SHALL NOT carry this header.

#### Scenario: PR audience prepends the tracked link

- **GIVEN** `audience: "pr"`, `issueNumber: 42`, `repo: { owner: "o", name: "r" }`
- **WHEN** the sticky is rendered
- **THEN** the body contains `> Tracked on issue [#42](https://github.com/o/r/issues/42) →`

### Requirement: App-not-installed surfaces a discreet install hint

When the renderer is called with `appInstalled: false`, the body SHALL include a discreet italic line above the footer: `_Install the [openspec-flow App](https://github.com/apps/openspec-flow) on this repository for real-time updates instead of every-workflow-run refreshes._`. When `appInstalled: true`, the hint SHALL be omitted.

#### Scenario: Workflow-side write with no App identity shows the hint

- **GIVEN** the dispatch step ran without a broker token AND without legacy App secrets (GITHUB_TOKEN fallback)
- **THEN** the handler reads `OPENSPEC_FLOW_APP_INSTALLED=false`
- **AND** the sticky body contains `Install the [openspec-flow App]`

#### Scenario: App-side write omits the hint

- **WHEN** the Probot adapter pre-gate writes the sticky
- **THEN** the body does NOT contain `Install the [openspec-flow App]`

### Requirement: Active row states carry an optional inline step

`RowState.creating` and `RowState.pr-iterating` MAY include `step?: string`. When present, the row SHALL render as `<base> - <step> in workflow #N` instead of `<base> in workflow #N`.

#### Scenario: Creating with step renders sub-state inline

- **GIVEN** `spec: { kind: "creating", run: { number: 234, url: "..." }, step: "gathering context" }`
- **WHEN** the sticky is rendered
- **THEN** the Spec row contains `creating - gathering context in workflow [#234]`

#### Scenario: Creating without step renders the plain active phrase

- **GIVEN** `spec: { kind: "creating", run: { number: 234, url: "..." } }`
- **WHEN** the sticky is rendered
- **THEN** the Spec row contains `creating in workflow [#234]` and not a dangling hyphen
