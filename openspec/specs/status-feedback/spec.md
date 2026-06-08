# status-feedback Specification

## Purpose
TBD - created by archiving change bot-pregate-sticky-status. Update Purpose after archive.
## Requirements
### Requirement: Probot adapter posts the sticky status comment pre-gate for actionable lifecycle intents

When the Probot App classifies an event into one of the actionable lifecycle intents (`create-spec`, `iterate-spec`, `iterate-impl`, `create-impl`), the App SHALL upsert a sticky status comment on the target issue/PR BEFORE evaluating `OPENSPEC_FLOW_DISPATCH_MODE`. The body SHALL be the `statusReceived(intentSummary)` render. The marker SHALL be `<!-- openspec-flow:sticky intent=<kind> target=<n> -->`.

The pre-gate post SHALL be best-effort: any failure SHALL be logged at warn level and SHALL NOT block the rest of the handler.

#### Scenario: Sticky `received` appears within ~1 second on the right surface

- **GIVEN** the App is installed on a repo and `OPENSPEC_FLOW_DISPATCH_MODE` is unset (defaulting to `action`)
- **WHEN** a user adds `openspec:go` to an open issue (intent classifies to `create-spec`)
- **THEN** the App posts a sticky status comment on that issue containing the marker `<!-- openspec-flow:sticky intent=create-spec target=<n> -->` and a body that starts with `openspec-flow received: …. Starting…`
- **AND** the post happens before the App evaluates the dispatch-mode gate

#### Scenario: Sticky for create-impl lands on the spec PR, not the issue

- **GIVEN** a spec PR labelled `openspec:spec` is merged
- **WHEN** Probot classifies the event to `create-impl`
- **THEN** the App posts a sticky on the spec PR (the merge event's `targetNumber`), carrying the `create-impl` marker
- **AND** the App also posts the issue early breadcrumb on the originating issue (as today)

#### Scenario: Silent and visible noops do not post a sticky pre-gate

- **WHEN** the classifier returns a noop intent
- **THEN** the App does not post any sticky pre-gate
- **AND** visible-noop intents have their reason posted by the workflow's `runDispatch` as today

### Requirement: Sticky comment is created via marker-based upsert from the dispatch core

`runDispatch` SHALL create the initial sticky status comment via `upsertStickyComment` (marker-based). When the App has already posted the pre-gate sticky, the upsert SHALL find that comment and PATCH it. When no pre-gate sticky exists (Action-mode-only install), the upsert SHALL POST a fresh comment carrying the marker.

The `statusCommentId` returned to handlers SHALL be the upserted comment's id so subsequent `updateStatusComment` calls (which edit by id) continue to work without change.

#### Scenario: App-installed + workflow path → single comment, two writers

- **GIVEN** the App posted the sticky pre-gate at t=1s with the marker
- **WHEN** `runDispatch` runs in the workflow at t=30s and calls `upsertStickyComment` with the same intent + target
- **THEN** the existing comment is PATCHed (not duplicated)
- **AND** the returned `commentId` matches the App's posted comment id

#### Scenario: Action-mode-only install → workflow creates the sticky

- **GIVEN** the App is not installed on the repo (no pre-gate post)
- **WHEN** `runDispatch` upserts the sticky
- **THEN** a new comment is POSTed carrying the marker

### Requirement: Each (intent, target) pair has a unique marker

The sticky marker SHALL encode both the intent kind and the target number so different intents on the same target (e.g. `create-impl` sticky on the spec PR while `iterate-spec` runs against the same PR) get distinct comments. Re-running the same intent against the same target (e.g. re-applying `openspec:go` to iterate a spec PR) SHALL find the previous sticky via the marker and overwrite its body — the sticky reflects the latest run, not history.

#### Scenario: Different intents on the same target get separate stickies

- **GIVEN** a sticky exists on PR #43 with marker `intent=create-impl target=43`
- **WHEN** the user labels PR #43 with `openspec:go` to iterate the impl
- **THEN** the App posts a new sticky with marker `intent=iterate-impl target=43`
- **AND** the original `create-impl` sticky is untouched

#### Scenario: Re-iterating the same intent overwrites the previous sticky

- **GIVEN** a sticky exists on PR #43 with marker `intent=iterate-spec target=43` from a previous iteration
- **WHEN** the user re-applies `openspec:go` to iterate again
- **THEN** the existing sticky is PATCHed back to the `received` body for the new run
- **AND** no new comment is created

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

