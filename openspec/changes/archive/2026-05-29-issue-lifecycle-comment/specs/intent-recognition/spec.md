## ADDED Requirements

### Requirement: Classify merged impl PR as finalize-impl

The classifier SHALL return `{ kind: "finalize-impl", prNumber }` for a `pull_request.closed` event with `merged: true` on a PR carrying `openspec:impl` (and not also `openspec:spec`). This replaces the previous silent noop so the lifecycle comment can be stamped with its terminal line.

#### Scenario: Merged impl PR

- **WHEN** a `pull_request.closed` event arrives with `merged: true` on a PR labelled `openspec:impl`
- **THEN** the classifier returns `{ kind: "finalize-impl", prNumber }` with the PR number

#### Scenario: Impl PR closed unmerged is still a noop

- **WHEN** a `pull_request.closed` event arrives with `merged: false` on a PR labelled `openspec:impl`
- **THEN** the classifier does not return `finalize-impl`

## MODIFIED Requirements

### Requirement: Silent noop on irrelevant events

The classifier SHALL return `{ kind: "noop", visible: false, reason }`
without surfacing a comment for:

- Events from a sender whose `type === "Bot"`
- Label additions where the added label is anything other than
  `openspec:go`, `openspec:spec`, or `openspec:impl`
- Any event name or action not enumerated in the trigger table

#### Scenario: Bot sender
- **WHEN** an event arrives whose `sender.type` is `Bot`
- **THEN** the classifier returns a silent noop and the dispatcher
  posts no comment

#### Scenario: Non-trigger label
- **WHEN** a label other than `openspec:go`, `openspec:spec`, or
  `openspec:impl` is added to an issue or PR
- **THEN** the classifier returns a silent noop

#### Scenario: Irrelevant event
- **WHEN** an event name or action not in the trigger table arrives
- **THEN** the classifier returns a silent noop
