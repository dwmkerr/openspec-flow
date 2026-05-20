# intent-recognition Specification

## ADDED Requirements

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
