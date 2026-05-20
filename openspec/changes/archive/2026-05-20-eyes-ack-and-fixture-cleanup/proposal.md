## Why

Two operational gaps surfaced while running smoke tests:

1. The bot's only deterministic signal that it received an event is the
   classifier comment posted ~1s later. Until that comment lands, users
   have no feedback that the webhook landed. The Claude GitHub action
   solves this with an `eyes` reaction posted within milliseconds of
   the webhook arriving. We want the same: a deterministic ack that
   doubles as a TDD-able contract ("for every classified intent, an
   eyes reaction is created on the target").
2. Smoke-test scripts create issues with scenario-scoped labels
   (`test:create-issue`, `test:closed-issue-noop`, …) and only clean up
   their own prior runs. When a script is renamed or a label is
   abandoned, the issues become orphans — see #1 (no test label),
   #2 (`test:create-issue-test` from a renamed script), #5
   (`test:create-issue`). The repo accumulates fixture cruft. We need
   a single marker label every fixture carries, and a `make test-cleanup`
   target that wipes anything bearing it.

## What Changes

- **Eyes reaction**: in `src/index.ts` dispatcher, before posting the
  classifier comment, call `issues.createReaction({ content: 'eyes' })`
  on the target issue/PR. Same gate as the comment (intent is
  actionable OR visible noop). Best-effort: a reaction-API failure
  logs a warning but does not block the comment. GitHub deduplicates
  reactions per user+content, so re-runs are idempotent.
- **Eyes reaction is NOT posted** for silent noops (bot senders,
  non-trigger labels, off-flow comments). Silent means silent.
- **Single fixture label**: every test script applies `test:fixture`
  in addition to its scenario label. The label is red
  (`d73a4a`, `Test artefact — safe to delete`) and is the contract
  `test-cleanup` relies on. Add a helper `create_fixture_issue` in
  `tests/scripts/_lib.sh` that ensures both labels exist and applies
  both at creation.
- **`make test-cleanup`**: new target backed by
  `tests/scripts/cleanup.sh`. Deletes every issue (any state) and
  closes/deletes-branch every PR (any state) carrying `test:fixture`.
  Idempotent. Prints what it deleted.
- **Orphan cleanup**: existing issues #1, #2, #5 do not carry
  `test:fixture`. The script can't reach them. Document a one-time
  manual cleanup (or back-fill the label) in the change's tasks.md.
- **Integration test coverage**: extend `tests/integration/intent.test.ts`
  to assert that every actionable + visible-noop case posts an eyes
  reaction (before the comment), and that silent-noop cases post
  none. Use `nock` to intercept both endpoints.

## Capabilities

### New Capabilities

- `test-fixtures`: contract for identifying and cleaning up
  GitHub-side artefacts created by smoke-test scripts. Defines the
  `test:fixture` marker label, the per-scenario label convention, and
  the `make test-cleanup` cleanup guarantee.

### Modified Capabilities

- `intent-recognition`: dispatcher now posts an `eyes` reaction
  alongside the classifier comment for every actionable + visible-noop
  intent. Reaction is best-effort and never blocks the comment.

## Impact

- Modified: `src/index.ts` (dispatcher posts reaction),
  `tests/integration/intent.test.ts` (asserts reaction calls),
  `tests/scripts/_lib.sh` (fixture-label helper), all three existing
  `tests/scripts/test-*.sh` (call the helper),
  `Makefile` (`test-cleanup` target), `CLAUDE.md` (record fixture-label
  contract under "Patterns"), `openspec/specs/intent-recognition/spec.md`
  (via delta, eyes-ack section).
- New: `tests/scripts/cleanup.sh`,
  `openspec/specs/test-fixtures/spec.md` (via delta).
- New deps: none.
- Cost: zero. Reaction API call is one extra request per actionable
  intent; well inside GitHub's rate budget.

## Out of scope

- Reacting to off-flow comments (`issue_comment.created` on a PR
  that doesn't carry `openspec:go`) — those classify to silent noop.
- Removing or replacing reactions on follow-up events (e.g. `rocket`
  on success). Future change.
- Auto-cleanup of orphan PRs left over from broken test runs that
  predate the `test:fixture` marker — document manual recovery only.
- A `test:fixture`-aware GitHub Action that runs on a schedule.
  Out of scope; local `make test-cleanup` is enough for now.
