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

