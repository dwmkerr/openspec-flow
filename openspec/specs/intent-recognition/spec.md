# intent-recognition Specification

## Purpose
TBD - created by archiving change wire-intent-recognition. Update Purpose after archive.
## Requirements
### Requirement: Classify openspec:go on a fresh issue as create-spec

The classifier SHALL return `{ kind: "create-spec", issueNumber, title }`
for an `issues.labeled` event where the added label is `openspec:go`,
the issue is open, and the payload does not include a `pull_request`
reference.

#### Scenario: Fresh issue labelled openspec:go
- **WHEN** the user labels an open issue with `openspec:go`
- **THEN** the classifier returns intent `create-spec` with the issue
  number and title

### Requirement: Classify openspec:go on lifecycle PRs as iterate-spec or iterate-impl

The classifier SHALL return `{ kind: "iterate-spec", prNumber }` for a
`pull_request.labeled` event where the added label is `openspec:go`,
the PR is open, and the PR carries `openspec:spec`. It SHALL return
`{ kind: "iterate-impl", prNumber }` for the same event when the PR
carries `openspec:impl` instead.

#### Scenario: openspec:go on spec PR
- **WHEN** the user labels a PR carrying `openspec:spec` with
  `openspec:go`
- **THEN** the classifier returns intent `iterate-spec` with the PR
  number

#### Scenario: openspec:go on impl PR
- **WHEN** the user labels a PR carrying `openspec:impl` with
  `openspec:go`
- **THEN** the classifier returns intent `iterate-impl` with the PR
  number

### Requirement: Classify merged spec PR as create-impl

The classifier SHALL return
`{ kind: "create-impl", specPrNumber, issueNumber }` for a
`pull_request.closed` event where `merged === true` and the PR carries
`openspec:spec`. The issue number SHALL be extracted from a
`closes|fixes|resolves #N` reference in the PR body (case-insensitive);
absent that, it SHALL be `null`.

#### Scenario: Spec PR merges with Closes reference
- **WHEN** a PR labelled `openspec:spec` merges into the default branch
  and the PR body contains `Closes #42`
- **THEN** the classifier returns intent `create-impl` with the spec
  PR number and `issueNumber: 42`

### Requirement: Visible noop on impossible triggers

The classifier SHALL return `{ kind: "noop", visible: true, reason }`
with a human-readable reason for `openspec:go` events that cannot be
classified as one of the positive intents. The dispatcher SHALL post
the reason as a comment on the target. The classifier MUST cover the
following cases:

- `openspec:go` on a closed issue or PR
- `openspec:go` on a PR with neither `openspec:spec` nor `openspec:impl`
- `openspec:go` on a PR carrying both `openspec:spec` and `openspec:impl`
- Spec PR closed without merging (event `pull_request.closed` with
  `merged: false` and label `openspec:spec`)
- User-driven application of `openspec:spec` or `openspec:impl`
  (label added by a sender whose `type === "User"`)

#### Scenario: openspec:go on closed issue
- **WHEN** the user labels a closed issue with `openspec:go`
- **THEN** the classifier returns a visible noop whose reason mentions
  that the issue is closed

#### Scenario: User applies openspec:spec manually
- **WHEN** a user (sender type `User`) applies `openspec:spec` to a PR
- **THEN** the classifier returns a visible noop indicating
  openspec-flow is stepping back from that PR

### Requirement: Silent noop on irrelevant events

The classifier SHALL return `{ kind: "noop", visible: false, reason }`
without surfacing a comment for:

- Events from a sender whose `type === "Bot"`
- Label additions where the added label is anything other than
  `openspec:go`, `openspec:spec`, or `openspec:impl`
- `pull_request.closed` events with `merged: true` on a PR carrying
  `openspec:impl` (the impl PR's own commits handle archival;
  nothing more to do)
- Any event name or action not enumerated in the trigger table

#### Scenario: Bot sender
- **WHEN** an event arrives whose `sender.type` is `Bot`
- **THEN** the classifier returns a silent noop and the dispatcher
  posts no comment

#### Scenario: Non-trigger label
- **WHEN** a label other than `openspec:go`, `openspec:spec`, or
  `openspec:impl` is added to an issue or PR
- **THEN** the classifier returns a silent noop

### Requirement: Purity

The `classify` function SHALL be pure: same inputs produce the same
output, no network calls, no filesystem access, no module-level state.

#### Scenario: Same payload twice
- **WHEN** `classify` is called with the same `eventName` and `payload`
  twice
- **THEN** both calls return the same `Intent` value

### Requirement: Linkage metadata block

The bot SHALL write an HTML-comment metadata block at the end of every
PR body it opens. The block SHALL be parseable by the metadata module
and SHALL carry, at minimum, `issue`, `kind`, and `change` keys.
Implementation PRs SHALL additionally carry a `spec-pr` key referencing
the merged spec PR.

#### Scenario: Spec PR body
- **WHEN** the bot opens a spec PR for issue 42 on change
  `add-csv-export`
- **THEN** the PR body ends with an HTML-comment block parseable by
  `metadata.parse`, returning `{ issue: 42, kind: "spec", change: "add-csv-export" }`

### Requirement: Post an eyes reaction for every actionable or visible-noop intent

The dispatcher SHALL post a `content: "eyes"` reaction on the target
issue or PR before posting the classifier comment, for every intent
where `isActionable(intent)` is true (i.e. `kind !== "noop"` OR
`noop.visible === true`). The reaction call SHALL use the issues
reactions endpoint (`POST /repos/{owner}/{repo}/issues/{issue_number}/reactions`),
which accepts both issue and PR numbers.

#### Scenario: Eyes reaction precedes comment on actionable intent
- **WHEN** the classifier returns an actionable intent (e.g.
  `create-spec`) and the dispatcher runs
- **THEN** the dispatcher POSTs `{ content: "eyes" }` to the issue's
  reactions endpoint before POSTing the classifier comment

#### Scenario: Eyes reaction posted on visible noop
- **WHEN** the classifier returns `{ kind: "noop", visible: true }`
  (e.g. `openspec:go` on a closed issue)
- **THEN** the dispatcher posts both an eyes reaction and the
  visible-noop comment

### Requirement: Silent noops post no reaction

The dispatcher SHALL NOT call the reactions endpoint for silent noops
(`{ kind: "noop", visible: false }`), including bot-sender events,
non-trigger label changes, and off-flow comment events.

#### Scenario: Bot-sender event posts no reaction and no comment
- **WHEN** an event arrives with `sender.type === "Bot"` and
  classifies to silent noop
- **THEN** the dispatcher posts neither a reaction nor a comment

#### Scenario: Non-trigger label event posts no reaction and no comment
- **WHEN** a user adds a label other than `openspec:go` /
  `openspec:spec` / `openspec:impl` to an issue or PR
- **THEN** the dispatcher posts neither a reaction nor a comment

### Requirement: Reaction failure is non-fatal

A non-2xx response from the reactions endpoint SHALL be logged as a
warning with the event context and SHALL NOT prevent the classifier
comment from being posted.

#### Scenario: Reactions endpoint returns 403
- **WHEN** the reactions endpoint returns 403 (e.g. missing scope)
- **THEN** the dispatcher logs a warning and continues to post the
  classifier comment as normal

### Requirement: Dispatcher calls the create-spec handler

The dispatcher SHALL call `handleCreateSpec({ issueNumber, issueTitle, log: context.log })` after posting the eyes reaction and the classifier comment whenever the classifier returns a `create-spec` intent.

#### Scenario: create-spec intent triggers the handler
- **WHEN** the classifier returns a `create-spec` intent
- **THEN** the dispatcher posts the eyes reaction, posts the
  classifier comment, then awaits `handleCreateSpec(...)`

### Requirement: Handler failures do not crash the webhook

Errors thrown by handlers SHALL be caught by the dispatcher and
logged with `context.log.error(...)`. The webhook handler SHALL
return successfully so Probot does not retry on logic bugs.

#### Scenario: Handler throws
- **GIVEN** `handleCreateSpec` throws (e.g. missing API key)
- **WHEN** the dispatcher awaits it
- **THEN** the dispatcher catches the error, logs it with full
  context, and returns without re-throwing

### Requirement: Dispatcher routes create-impl intents to the create-impl handler

The dispatcher SHALL invoke `handleCreateImpl({ mode: "sequential", specPrNumber, ... })` whenever the classifier returns a `create-impl` intent (i.e. `pull_request.closed` with `merged: true` and the PR carries `openspec:spec`). Handler errors SHALL be caught and logged so the webhook handler never re-throws.

#### Scenario: create-impl intent triggers the handler
- **WHEN** the classifier returns a `create-impl` intent
- **THEN** the dispatcher invokes `handleCreateImpl` with
  `mode: "sequential"` and the spec PR number

#### Scenario: Handler failure does not crash the webhook
- **GIVEN** `handleCreateImpl` throws
- **WHEN** the dispatcher awaits it
- **THEN** the dispatcher catches the error, logs it with context,
  and returns without re-throwing

