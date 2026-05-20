# intent-recognition Specification

## ADDED Requirements

### Requirement: Dispatcher routes iterate-spec intents to the iterate-spec handler

The dispatcher SHALL invoke `handleIterateSpec({ specPrNumber, ... })` whenever the classifier returns an `iterate-spec` intent (i.e. `pull_request.labeled` with `openspec:go` on a PR carrying `openspec:spec`). Handler errors SHALL be caught and logged so the webhook handler never re-throws.

#### Scenario: iterate-spec intent triggers the handler
- **WHEN** the classifier returns an `iterate-spec` intent for PR #27
- **THEN** the dispatcher invokes `handleIterateSpec` with `specPrNumber: 27`

#### Scenario: Handler failure does not crash the webhook
- **GIVEN** `handleIterateSpec` throws
- **WHEN** the dispatcher awaits it
- **THEN** the dispatcher catches the error, logs it with context, and returns without re-throwing
