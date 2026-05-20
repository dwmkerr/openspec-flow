# intent-recognition Specification

## ADDED Requirements

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
