## MODIFIED Requirements

### Requirement: Post an eyes reaction for every actionable or visible-noop intent

The dispatcher SHALL post a `content: "eyes"` reaction on the target
issue or PR before upserting the sticky status comment, for every intent
where `isActionable(intent)` is true (i.e. `kind !== "noop"` OR
`noop.visible === true`). The reaction call SHALL use the issues
reactions endpoint (`POST /repos/{owner}/{repo}/issues/{issue_number}/reactions`),
which accepts both issue and PR numbers.

#### Scenario: Eyes reaction precedes sticky upsert on actionable intent
- **WHEN** the classifier returns an actionable intent (e.g.
  `create-spec`) and the dispatcher runs
- **THEN** the dispatcher POSTs `{ content: "eyes" }` to the issue's
  reactions endpoint before upserting the sticky status comment

#### Scenario: Eyes reaction posted on visible noop
- **WHEN** the classifier returns `{ kind: "noop", visible: true }`
  (e.g. `openspec:go` on a closed issue)
- **THEN** the dispatcher posts both an eyes reaction and the terminal
  sticky status comment

### Requirement: Dispatcher routes create-spec intents to the create-spec handler

The dispatcher SHALL call `handleCreateSpec({ issueNumber, issueTitle, log: context.log, updateStatus })` after posting the eyes reaction and upserting the sticky status comment to its working body whenever the classifier returns a `create-spec` intent. The `updateStatus(body)` callback SHALL be a thin wrapper around the same upsert helper used by the dispatcher, so handlers can flip the sticky to its terminal body when the outcome is known.

#### Scenario: create-spec intent triggers the handler
- **WHEN** the classifier returns a `create-spec` intent
- **THEN** the dispatcher posts the eyes reaction, upserts the
  sticky to its working body, then awaits
  `handleCreateSpec(...)` with an `updateStatus` callback

#### Scenario: Handler flips the sticky on success
- **GIVEN** `handleCreateSpec` has opened spec PR #M
- **WHEN** the handler calls `updateStatus("openspec opened spec PR: #M")`
- **THEN** the dispatcher's sticky comment body is replaced with that
  terminal body (no liveness indicator)

### Requirement: Dispatcher routes create-impl intents to the create-impl handler

The dispatcher SHALL invoke `handleCreateImpl({ mode: "sequential", specPrNumber, updateStatus, ... })` whenever the classifier returns a `create-impl` intent (i.e. `pull_request.closed` with `merged: true` and the PR carries `openspec:spec`). The dispatcher SHALL first post the eyes reaction and upsert the sticky to its working body. Handler errors SHALL be caught and logged; the dispatcher's error handler SHALL then upsert the sticky to a terminal failure body so the webhook handler never re-throws.

#### Scenario: create-impl intent triggers the handler
- **WHEN** the classifier returns a `create-impl` intent
- **THEN** the dispatcher invokes `handleCreateImpl` with
  `mode: "sequential"`, the spec PR number, and an `updateStatus`
  callback

#### Scenario: Handler failure does not crash the webhook
- **GIVEN** `handleCreateImpl` throws
- **WHEN** the dispatcher awaits it
- **THEN** the dispatcher catches the error, logs it with context,
  upserts the sticky to a terminal failure body, and returns
  without re-throwing
