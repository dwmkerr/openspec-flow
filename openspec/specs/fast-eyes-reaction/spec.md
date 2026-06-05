# fast-eyes-reaction Specification

## Purpose
TBD - created by archiving change fast-eyes-reaction. Update Purpose after archive.
## Requirements
### Requirement: Probot adds the 👀 reaction before the dispatch-mode gate

When the Probot App receives an `issues.labeled` or `pull_request.labeled` webhook whose added label is `openspec:go` and the classified intent is one of `create-spec`, `iterate-spec`, or `iterate-impl`, the App SHALL call `addEyes` on the target issue/PR BEFORE evaluating `OPENSPEC_FLOW_DISPATCH_MODE`. This makes the acknowledgement sub-second for App-installed repos regardless of which dispatcher will handle the work.

`addEyes` SHALL be best-effort: any non-2xx response SHALL be logged at warn level and SHALL NOT block the rest of the handler.

#### Scenario: openspec:go on an issue in action mode

- **GIVEN** the App is installed on a repo, `OPENSPEC_FLOW_DISPATCH_MODE` is unset (defaulting to `action`), and there is an open issue with no linked spec PR
- **WHEN** the user adds the `openspec:go` label
- **THEN** the App posts a 👀 reaction on the issue within the lifetime of the webhook handler (sub-second)
- **AND** the App does not call `runDispatch` (the shim workflow handles the dispatch)

#### Scenario: openspec:go on a spec PR in in-process mode

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE=in-process` is set and a spec PR carries `openspec:spec`
- **WHEN** the user adds `openspec:go` to the PR
- **THEN** the App posts a 👀 reaction on the PR before invoking `runDispatch`

#### Scenario: openspec:go on a closed issue

- **GIVEN** an issue is closed
- **WHEN** the user adds `openspec:go`
- **THEN** the classifier returns a noop intent
- **AND** the App does not add a 👀 reaction

### Requirement: Eyes reaction is removed when the openspec-flow workflow completes

The Probot App SHALL handle the `workflow_run.completed` event, filter to events whose `workflow_run.name === "openspec-flow"`, parse the originating issue/PR number from the run's `head_branch` (matching `chore/<n>-<slug>` or `feat/<n>-<slug>`), and call `removeEyes` on that issue/PR. The removal SHALL fire on both success and failure conclusions.

`removeEyes` SHALL list reactions of content `eyes` on the target issue/PR, remove every one authored by an openspec-flow identity (e.g. `<slug>[bot]`, `github-actions[bot]`), and SHALL swallow 404 responses.

#### Scenario: Successful workflow run removes eyes

- **GIVEN** an issue carries a 👀 reaction added by the App on `openspec:go`
- **WHEN** the openspec-flow workflow completes successfully on branch `chore/42-add-export`
- **THEN** the App removes the 👀 reaction from issue #42

#### Scenario: Failed workflow run still removes eyes

- **GIVEN** an issue carries a 👀 reaction added by the App on `openspec:go`
- **WHEN** the openspec-flow workflow completes with `conclusion: failure` on branch `chore/42-add-export`
- **THEN** the App removes the 👀 reaction from issue #42 anyway

#### Scenario: Unrelated workflow_run is ignored

- **GIVEN** an issue carries a 👀 reaction
- **WHEN** a `workflow_run.completed` event fires for a workflow named `ci-tests`
- **THEN** the App does not touch the reaction

### Requirement: `runDispatch` adds and removes eyes around its work

`runDispatch` SHALL call `addEyes` on entry (preserving today's behaviour, which is the only reaction signal in Action-mode-only installs) and SHALL call `removeEyes` on every exit path (success and failure). Both calls SHALL use the shared `src/reactions.ts` helper.

#### Scenario: Action-mode-only install gets eyes from the workflow

- **GIVEN** a repo has the shim workflow merged but the openspec-flow App is not installed
- **WHEN** a user labels an issue with `openspec:go` and the workflow runs to completion
- **THEN** the workflow's `runDispatch` call adds a 👀 reaction at the start of dispatch
- **AND** the workflow's `runDispatch` call removes the 👀 reaction before returning

#### Scenario: Dispatch failure still removes eyes

- **GIVEN** `addEyes` succeeded
- **WHEN** the handler throws while opening the spec PR
- **THEN** `runDispatch` calls `removeEyes` before propagating the error

### Requirement: `addEyes` and `removeEyes` are idempotent

The `src/reactions.ts` helpers SHALL be safe to call from multiple paths against the same issue/PR within the same lifecycle: duplicate adds SHALL not throw (GitHub returns 200 on the existing reaction); removes against an absent reaction SHALL not throw (404 swallowed).

#### Scenario: Probot adds, then dispatch core adds — no error

- **GIVEN** Probot has already added 👀 on `openspec:go`
- **WHEN** `runDispatch` (running in the same install repo via the shim) calls `addEyes` on the same issue
- **THEN** the call completes without throwing
- **AND** the issue still carries exactly one 👀 reaction from each unique author

#### Scenario: Remove after already-removed — no error

- **GIVEN** the dispatch core has already removed 👀
- **WHEN** the `workflow_run.completed` handler calls `removeEyes`
- **THEN** the call completes without throwing

