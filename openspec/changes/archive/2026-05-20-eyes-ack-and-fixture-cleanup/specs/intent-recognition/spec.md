# intent-recognition Specification

## ADDED Requirements

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
