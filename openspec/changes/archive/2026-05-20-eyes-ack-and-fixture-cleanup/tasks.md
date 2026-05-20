# Tasks — eyes-ack-and-fixture-cleanup

Work order is TDD: failing integration tests first, then the dispatcher
change to make them pass, then the fixture-label scaffolding.

## 1. Integration tests (red)

- [ ] 1.1 Extend `tests/integration/intent.test.ts` with a helper
      `stubReaction(issueNumber)` that intercepts
      `POST /repos/dwmkerr/openspec-flow/issues/{n}/reactions` and
      returns 201, capturing the request body.
- [ ] 1.2 For each existing "posts comment" test (actionable + visible
      noop), assert the reaction body is `{ content: "eyes" }` and
      that the reaction call happened before the comment call.
- [ ] 1.3 For each existing silent-noop test (bot sender, non-trigger
      label, impl PR merged), extend the `fail400OnAnythingElse` mock
      to also reject reaction POSTs. Reaching the assertion proves no
      reaction was attempted.
- [ ] 1.4 Run `npm run test:all`; new reaction assertions fail (red).

## 2. Dispatcher change (green)

- [ ] 2.1 In `src/index.ts`, add `reactEyes(context, issueNumber)`:
      calls `context.octokit.reactions.createForIssue` (or raw POST
      via `request`) with `content: "eyes"`. Wrap in try/catch;
      warn-log on failure with `eventContext(context)`.
- [ ] 2.2 In `dispatch`, call `reactEyes` before
      `issues.createComment`, gated identically.
- [ ] 2.3 Re-run `npm run test:all`; all tests pass (green).

## 3. Fixture label + cleanup

- [ ] 3.1 In `tests/scripts/_lib.sh`, add `FIXTURE_LABEL="test:fixture"`
      constant and `create_fixture_issue` helper that ensures both
      `test:fixture` (color `d73a4a`, description
      `Test artefact — safe to delete`) and the scenario label exist,
      then creates the issue with both applied.
- [ ] 3.2 Update `tests/scripts/test-create-issue.sh`,
      `tests/scripts/test-closed-issue-noop.sh`,
      `tests/scripts/test-foreign-pr-noop.sh` to call
      `create_fixture_issue` instead of `create_issue`.
- [ ] 3.3 Create `tests/scripts/cleanup.sh`: lists all issues with
      `test:fixture` (any state) and deletes them; lists all PRs with
      `test:fixture` (any state) and closes them with
      `--delete-branch`. Prints summary. Exits 0 on no-op.
- [ ] 3.4 Add `make test-cleanup` target to `Makefile` invoking the
      script.
- [ ] 3.5 Smoke-test the script: run a test script, confirm artefact
      gets `test:fixture`, run `make test-cleanup`, confirm deletion.

## 4. Orphan cleanup

- [ ] 4.1 Back-fill `test:fixture` on issues #1, #2, #5 manually
      (`gh issue edit <n> --add-label test:fixture`).
- [ ] 4.2 Run `make test-cleanup` and confirm orphans are deleted.

## 5. Docs sync

- [ ] 5.1 Update `CLAUDE.md` under "Patterns": add bullet
      "Test scripts label every fixture with `test:fixture`;
      `make test-cleanup` deletes by that label."
- [ ] 5.2 Update `Makefile` `help` output is auto-generated; no
      manual edit needed.

## 6. Validate + archive

- [ ] 6.1 `openspec validate --change eyes-ack-and-fixture-cleanup`
      passes.
- [ ] 6.2 Archive happens in the impl PR via
      `openspec archive eyes-ack-and-fixture-cleanup --yes`.
