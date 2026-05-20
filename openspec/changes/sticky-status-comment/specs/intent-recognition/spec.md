## MODIFIED Requirements

### Requirement: Post an eyes reaction for every actionable or visible-noop intent

The dispatcher SHALL post a `content: "eyes"` reaction on the target
issue or PR before reposting the sticky status comment, for every intent
where `isActionable(intent)` is true (i.e. `kind !== "noop"` OR
`noop.visible === true`). The reaction call SHALL use the issues
reactions endpoint (`POST /repos/{owner}/{repo}/issues/{issue_number}/reactions`),
which accepts both issue and PR numbers.

#### Scenario: Eyes reaction precedes sticky repost on actionable intent
- **WHEN** the classifier returns an actionable intent (e.g.
  `create-spec`) and the dispatcher runs
- **THEN** the dispatcher POSTs `{ content: "eyes" }` to the issue's
  reactions endpoint before reposting the sticky status comment

#### Scenario: Eyes reaction posted on visible noop
- **WHEN** the classifier returns `{ kind: "noop", visible: true }`
  (e.g. `openspec:go` on a closed issue)
- **THEN** the dispatcher posts both an eyes reaction and reposts the
  terminal sticky status comment

### Requirement: Dispatcher routes create-spec intents to the create-spec handler

The dispatcher SHALL call `handleCreateSpec({ issueNumber, issueTitle, log: context.log, updateStatus })` after posting the eyes reaction and reposting the sticky status comment to its working body whenever the classifier returns a `create-spec` intent. The `updateStatus(body)` callback SHALL wrap `octokit.issues.updateComment` with the comment id of the sticky just posted by the dispatcher closed over, so the handler patches the sticky in place at the terminal-state transition. The handler SHALL NOT repost; repost is reserved for the dispatcher boundary.

#### Scenario: create-spec intent triggers the handler
- **WHEN** the classifier returns a `create-spec` intent
- **THEN** the dispatcher posts the eyes reaction, reposts the
  sticky (POST new working body, DELETE prior stickies), then
  awaits `handleCreateSpec(...)` with an `updateStatus` callback
  bound to the new sticky's comment id

#### Scenario: Handler patches the sticky on success
- **GIVEN** `handleCreateSpec` has opened spec PR #M
- **WHEN** the handler calls `updateStatus("openspec opened spec PR: #M")`
- **THEN** the dispatcher's just-posted sticky is patched in place
  via `updateComment` (no new comment, no further DELETE pass)
- **AND** the sticky stays at its current position (the bottom of
  the thread)

### Requirement: Dispatcher routes create-impl intents to the create-impl handler

The dispatcher SHALL invoke `handleCreateImpl({ mode: "sequential", specPrNumber, updateStatus, ... })` whenever the classifier returns a `create-impl` intent (i.e. `pull_request.closed` with `merged: true` and the PR carries `openspec:spec`). The dispatcher SHALL first post the eyes reaction and repost the sticky to its working body. Handler errors SHALL be caught and logged; the dispatcher's error handler SHALL then patch the sticky in place to a terminal failure body so the webhook handler never re-throws.

#### Scenario: create-impl intent triggers the handler
- **WHEN** the classifier returns a `create-impl` intent
- **THEN** the dispatcher invokes `handleCreateImpl` with
  `mode: "sequential"`, the spec PR number, and an `updateStatus`
  callback bound to the new sticky's comment id

#### Scenario: Handler failure does not crash the webhook
- **GIVEN** `handleCreateImpl` throws
- **WHEN** the dispatcher awaits it
- **THEN** the dispatcher catches the error, logs it with context,
  patches the sticky in place to a terminal failure body, and
  returns without re-throwing
