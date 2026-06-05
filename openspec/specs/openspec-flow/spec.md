# openspec-flow Specification

## Purpose

A single GitHub Actions workflow that automates the full OpenSpec
lifecycle — **plan**, **implement**, and **respond** — from a single file
(`.github/workflows/openspec-flow.yaml`). The workflow turns GitHub
events into OpenSpec stages, drives Claude Code to produce the artifacts
and code, and maintains the issue/PR label lifecycle so humans know
exactly what state each piece of work is in.
## Requirements
### Requirement: The create-spec beat opens a real spec PR

The bot SHALL open a pull request labelled `openspec:spec` on branch `chore/<n>-<slug>` with a body containing the auto-maintained metadata block linking back to the issue, and SHALL then comment on the originating issue with the spec PR number, whenever a user adds `openspec:go` to an open issue and the agent runs to completion.

#### Scenario: Happy-path create-spec
- **GIVEN** an open issue #N with the `openspec:go` label freshly
  applied
- **WHEN** the bot processes the event
- **THEN** a spec PR is opened against `main` carrying the
  `openspec:spec` label and the issue receives a comment
  `spec PR opened: #M`

### Requirement: The create-impl beat opens a real impl PR

The bot SHALL open a pull request labelled `openspec:impl` on branch `feat/<n>-<slug>` with a body containing the auto-maintained metadata block linking back to the issue AND the spec PR, whenever a spec PR labelled `openspec:spec` is merged.

#### Scenario: Sequential happy-path
- **GIVEN** an open issue #N tracked by a spec PR labelled `openspec:spec`
- **WHEN** the spec PR is merged to main
- **THEN** an impl PR opens against `main` labelled `openspec:impl`,
  and the originating issue receives a comment `impl PR opened: #M`

### Requirement: Chained mode opens the impl PR alongside the spec PR

When `OPENSPEC_FLOW_CHAINED_MODE=true`, the bot SHALL open the impl PR immediately after opening the spec PR, with the impl PR's `base` set to the spec branch (stacked PR). The impl PR's base SHALL automatically retarget to `main` when the spec PR later merges.

#### Scenario: Chained mode happy-path
- **GIVEN** `OPENSPEC_FLOW_CHAINED_MODE=true` and an issue receives
  `openspec:go`
- **WHEN** the bot finishes opening the spec PR
- **THEN** the bot immediately opens an impl PR with `base:
  chore/<n>-<slug>` and `head: feat/<n>-<slug>` labelled
  `openspec:impl`

### Requirement: Reviewers can iterate a spec PR by re-applying openspec:go

The bot SHALL update the spec PR in place — by force-pushing an iterated commit to the existing `chore/<n>-<slug>` branch and posting `spec updated by openspec-flow` on the PR — whenever a user adds `openspec:go` to an open PR labelled `openspec:spec`.

#### Scenario: Reviewer iterates a spec PR
- **GIVEN** an open spec PR #27 labelled `openspec:spec`
- **WHEN** a reviewer adds `openspec:go` after leaving review comments
- **THEN** the bot rewrites the spec on the existing branch and comments `spec updated by openspec-flow` on PR #27

### Requirement: The user SHALL see one sticky status comment per actionable intent

For every actionable intent the bot SHALL produce a single comment on the originating issue/PR whose body mutates from receipt to working to terminal state. Reviewers SHALL NOT see a thread of separate intent / progress / completion comments.

#### Scenario: One sticky comment after create-spec
- **WHEN** a user adds `openspec:go` to an issue and the create-spec flow completes
- **THEN** the originating issue carries one bot comment whose final body names the opened spec PR (or the failure reason)

### Requirement: Classify-and-dispatch is the single routing model

openspec-flow SHALL turn every relevant GitHub event into a typed `Intent` via the `classify()` function and route actionable intents through the handler registry. There SHALL be no per-intent branching outside the registry, and no body/comment scanning for intent — the deterministic trigger is the label state per the CLAUDE.md trigger table.

#### Scenario: Event becomes an intent then a registry dispatch

- **WHEN** a subscribed event arrives in either execution mode
- **THEN** it is classified into exactly one `Intent`
- **AND** an actionable intent is routed via the registry to its handler

### Requirement: App and Action modes share one dispatch core

openspec-flow SHALL run in two modes — the Probot App and the GitHub Action — that share the same `runDispatch` core, such that any change to routing behaviour applies to both. In the Probot App, in-proc dispatch of `issues` and `pull_request` events SHALL be gated by the environment variable `OPENSPEC_FLOW_DISPATCH_MODE`: when its value is `in-process`, the App adapter SHALL call `runDispatch` for these events; for any other value (including unset), the App adapter SHALL no-op these events so the Action adapter — running in the user's repository — is the sole dispatcher. The `installation.created` handler SHALL ignore the flag and always run, because no Action-mode path exists for installation events. **Best-effort acknowledgement side effects (specifically the 👀 reaction add/remove via `src/reactions.ts`) are also exempt from the dispatch-mode gate** — the gate scopes dispatch, not acknowledgement. The App adapter MAY call `addEyes` before the gate and `removeEyes` from a separate event handler (`workflow_run.completed`) regardless of the flag value.

#### Scenario: Both modes produce the same outcome for the same event when in-process is enabled

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE=in-process` is set for the Probot App
- **WHEN** an `openspec:go` label is applied to an issue with no linked spec PR
- **THEN** both the App adapter and the Action adapter classify `create-spec` and open a spec PR through the same handler

#### Scenario: App adapter no-ops issue events in default mode

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE` is unset (or any value other than `in-process`)
- **WHEN** Probot receives an `issues.labeled` webhook for `openspec:go`
- **THEN** the App adapter does not call `runDispatch`
- **AND** the Action adapter (the shim workflow in the user's repo) is responsible for handling the event

#### Scenario: Install bootstrap runs regardless of dispatch mode

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE` is unset
- **WHEN** Probot receives an `installation.created` webhook
- **THEN** the App adapter runs the install-bootstrap handler

#### Scenario: Eyes reaction is added regardless of dispatch mode

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE` is unset
- **WHEN** Probot receives an `issues.labeled` webhook adding `openspec:go` to an open issue
- **THEN** the App adapter calls `addEyes` on the issue
- **AND** the App adapter still no-ops the dispatch (the shim handles it)

### Requirement: Probot logs the active dispatch mode on boot

The Probot App SHALL log a line of the form `dispatch-mode=<value>` exactly once during startup, where `<value>` is the effective dispatch mode (`in-process` or `action`). The line SHALL be emitted at info level so operators can confirm the active path without enabling debug logging.

#### Scenario: Default mode logged

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE` is unset
- **WHEN** the Probot App starts
- **THEN** the startup log contains the line `dispatch-mode=action`

#### Scenario: In-process mode logged

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE=in-process` is set
- **WHEN** the Probot App starts
- **THEN** the startup log contains the line `dispatch-mode=in-process`

### Requirement: `runDispatch` returns a structured result so callers can bubble failures

`runDispatch` SHALL return a `Promise<DispatchResult>` where `DispatchResult = { ok: boolean; error?: Error }`. `ok` SHALL be `false` when a handler throws or when the classifier returned an intent that has no registered handler (`result.dispatched === false`). The CLI's `dispatch` step SHALL exit non-zero when `ok` is false so the workflow's run badge reflects reality. The Probot adapter MAY ignore `ok` because it has no exit-code semantics; it SHALL continue to log the error via `deps.logError` (or `deps.log.warn` as fallback).

#### Scenario: Handler throws → CLI exit non-zero

- **GIVEN** the `openspec-flow dispatch` CLI command runs an event whose classified intent has a registered handler
- **WHEN** the handler throws
- **THEN** `runDispatch` returns `{ ok: false, error: <the error> }`
- **AND** the CLI step exits 1

#### Scenario: Unimplemented intent → ok=false

- **WHEN** the classifier returns an intent for which `dispatchTo` reports `dispatched: false`
- **THEN** `runDispatch` returns `{ ok: false }`
- **AND** the CLI step exits 1

#### Scenario: Happy path → ok=true

- **WHEN** the handler completes successfully
- **THEN** `runDispatch` returns `{ ok: true }`
- **AND** the CLI step exits 0

#### Scenario: Visible noop → ok=true

- **WHEN** the intent is a visible noop and the sticky comment is posted
- **THEN** `runDispatch` returns `{ ok: true }` (noops are not failures)

