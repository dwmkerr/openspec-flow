## 0. Metadata parser/serializer (pure, no I/O)

- [x] 0.1 Implement `src/metadata.ts` with `PrMetadata` type (issue, kind, change, optional specPr) and pure functions `serialize(meta): string` and `parse(body: string): PrMetadata | null`.
- [x] 0.2 The serialized block is wrapped in `<!-- openspec-flow:auto-maintained — do not remove or edit\n...\n-->`. Parser tolerates leading/trailing whitespace and missing optional fields.
- [x] 0.3 Unit tests for round-trip + tolerance for malformed input (no comment present, partial fields, multiple comments).

## 1. Types and classifier (pure, no I/O)

- [x] 1.1 Extend `src/intent.ts` with the `Intent` discriminated union: `create-spec`, `iterate-spec`, `create-impl`, `iterate-impl`, `noop` (with `visible: boolean` and `reason: string`).
- [x] 1.2 Add `describe(intent)` cases for every variant. Visible noops format as "Ignored: <reason>."
- [x] 1.3 Implement `classify(eventName, payload): Intent`. Pure function. No network. Returns `noop` (silent or visible) for anything not in the trigger table.
- [x] 1.4 Implement `labelsOn(payload)` and `triggerLabel(payload)` helpers — derive "label being added" and "labels currently on target" from any event.
- [x] 1.5 Implement edge-case detection helpers used by `classify`: `hasOpenSpecPRForIssue`, `prHasBothLifecycleLabels`, `isManuallyAppliedBotLabel`, etc. These can read only the payload; cross-event state lookups stay out of scope.

## 2. Dispatcher

- [x] 2.1 Replace the per-event handlers in `src/index.ts` with a single `app.onAny` that calls `classify` and routes to a thin `dispatch(intent, context)`.
- [x] 2.2 `dispatch` logs the intent at `info` level. For actionable intents and visible noops, posts a comment on the relevant issue/PR using `describe(intent)`. Silent noops log only.
- [x] 2.3 Suppress dispatch when `payload.sender.type === "Bot"` to prevent self-trigger loops.

## 3. Fixtures

- [x] 3.1 Add `tests/fixtures/` with one captured payload per supported event. Source from `@octokit/webhooks-examples` plus our own captured webhook deliveries (scrubbed of tokens).
- [x] 3.2 Add helper `tests/fixtures/load.ts` returning typed payloads.

## 4. Unit tests — classifier

- [x] 4.1 One test per positive intent (issue labeled openspec:go → create-spec, etc.) using minimal hand-crafted payloads.
- [x] 4.2 One test per visible-noop case (openspec:go on closed issue, on foreign PR, on PR with both lifecycle labels, etc.) asserting the `reason` text.
- [x] 4.3 One test per silent-noop case (push, branch create, label edit, bot sender) asserting `visible: false`.
- [x] 4.4 Label helper unit tests for `labelsOn` and `triggerLabel`.

## 5. Integration tests — dispatcher

- [x] 5.1 Use `probot.receive()` with each fixture; for actionable + visible-noop intents assert that `issues.createComment` is called with the expected body.
- [x] 5.2 For silent-noop fixtures assert that `issues.createComment` is NOT called.
- [x] 5.3 Use `nock` to fail the test if any non-comment Octokit endpoint is hit (proves no side effects beyond the comment).
- [x] 5.4 Cover the "bot sender suppressed" path — verify no comment is posted when the sender is a bot.

## 6. Design documentation

- [x] 6.1 Write `openspec/changes/wire-intent-recognition/design.md` with one section per intent: `create-spec`, `iterate-spec`, `create-impl`, `iterate-impl`. Each section: triggers, inputs, outputs, failure contract. Plus a "visible-noop catalogue" section. High-level only.

## 7. Capability spec

- [x] 7.1 Write `openspec/changes/wire-intent-recognition/specs/intent-recognition/spec.md` (new capability). Format: `## ADDED Requirements` for each rule, with scenarios per intent and per visible-noop.

## 8. Sync and validate

- [x] 8.1 Update `CLAUDE.md` if the trigger table evolves during implementation.
- [x] 8.2 Run `openspec validate --change wire-intent-recognition`.
- [x] 8.3 Run `npm test`, `npm run typecheck`, `npm run lint`. All green.
- [x] 8.4 Open PR. CI green. Merge.
