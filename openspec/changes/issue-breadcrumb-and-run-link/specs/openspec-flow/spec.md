# openspec-flow Specification Delta

## ADDED Requirements

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
