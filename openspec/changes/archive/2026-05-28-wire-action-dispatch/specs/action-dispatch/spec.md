## ADDED Requirements

### Requirement: Single dispatch core

A single function `runDispatch(intent, deps)` in `src/dispatch.ts` SHALL own the actionable-intent sequence: eyes reaction, sticky status comment creation, visible-noop terminal handling, token acquisition, registry dispatch, and unhandled-intent visible failure. It SHALL depend only on a minimal octokit, repo coordinates, a logger, and a `getToken()` callback — never on Probot's `Context`.

#### Scenario: Probot adapter calls the core

- **WHEN** a webhook reaches the Probot entry point and classifies to an actionable intent
- **THEN** `src/index.ts` builds `deps` from the webhook context and calls `runDispatch`
- **AND** no dispatch sequencing logic remains inline in `src/index.ts` beyond building `deps` and the silent-noop log shortcut

#### Scenario: Token minted only for handler-bound intents

- **WHEN** `runDispatch` processes a visible-noop intent
- **THEN** `getToken()` is not called
- **AND** the sticky status comment is left in its terminal state

### Requirement: dispatch CLI command

The `openspec-flow` binary SHALL expose a `dispatch` subcommand. It SHALL read the event name from `$GITHUB_EVENT_NAME` and the webhook payload from the JSON file at `$GITHUB_EVENT_PATH`, classify the event with the same `classify()` used by the Probot adapter, construct an octokit authenticated from `GITHUB_TOKEN`, and call `runDispatch`.

#### Scenario: Classifies a labeled event from the event file

- **WHEN** `openspec-flow dispatch` runs with `GITHUB_EVENT_NAME=issues` and `GITHUB_EVENT_PATH` pointing at an `issues.labeled` payload carrying `openspec:go`
- **THEN** the command classifies the same intent the Probot adapter would for that payload
- **AND** routes it through the shared registry

#### Scenario: Missing event environment fails clearly

- **WHEN** `openspec-flow dispatch` runs without `GITHUB_EVENT_PATH` set
- **THEN** the command exits non-zero with a message naming the missing variable

#### Scenario: Token source is GITHUB_TOKEN

- **WHEN** `openspec-flow dispatch` builds dispatch deps
- **THEN** `getToken()` resolves to the value of `GITHUB_TOKEN` (or an App-minted token when one is provided via the environment)

### Requirement: Reusable workflow runs the dispatcher

The reusable workflow `.github/workflows/openspec-flow.yml` SHALL trigger on `issues.labeled`, `pull_request.labeled`, `pull_request.closed`, `issue_comment.created`, and `pull_request_review_comment.created`. It SHALL check out `dwmkerr/openspec-flow` at the ref the caller pinned, build it, and run `openspec-flow dispatch`. It SHALL NOT reference any `.github/actions/openspec-flow-*` composite action.

#### Scenario: Workflow dispatches a current intent

- **WHEN** a target repo with the shim installed receives `openspec:go` on an issue
- **THEN** the reusable workflow checks out and builds openspec-flow at the pinned ref
- **AND** runs `openspec-flow dispatch`, which opens a spec PR via the `create-spec` handler

#### Scenario: No composite-action references remain

- **WHEN** the reusable workflow is read
- **THEN** it contains no `uses: ./.github/actions/openspec-flow-*` reference

### Requirement: Conditional bot identity

The reusable workflow SHALL mint an App installation token via `actions/create-github-app-token` only when `OPENSPEC_FLOW_APP_ID` is non-empty, and SHALL prefer that token over `GITHUB_TOKEN` for the dispatch step. When App credentials are absent, the workflow SHALL fall back to `GITHUB_TOKEN`.

#### Scenario: App creds present yields bot identity

- **WHEN** the workflow runs with `OPENSPEC_FLOW_APP_ID` and `OPENSPEC_FLOW_PRIVATE_KEY` set
- **THEN** the dispatch step uses the minted App token
- **AND** commits are attributed to `openspec-flow[bot]`

#### Scenario: App creds absent falls back to GITHUB_TOKEN

- **WHEN** the workflow runs with `OPENSPEC_FLOW_APP_ID` empty
- **THEN** the App-token step is skipped
- **AND** the dispatch step uses `GITHUB_TOKEN`, attributing commits to `github-actions[bot]`
