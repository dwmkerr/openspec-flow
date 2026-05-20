# Tasks — wire-iterate-spec-handler

## 1. Handler

- [ ] 1.1 `src/handlers/iterate-spec/prompt.md` — tight three-step
      prompt: fetch issue + PR comments via `gh`, edit artefacts,
      validate.
- [ ] 1.2 `src/handlers/iterate-spec/verify.ts` — `verifyIterateWorkdir(workdir, changeName)`:
      git dirty AND `openspec/changes/<name>/` still exists.
- [ ] 1.3 `src/handlers/iterate-spec/index.ts` orchestrating:
      clone → preconditions → octokit.pulls.get → state check →
      parseSpecPrMetadata → fetchAndCheckoutBranch → runAgent →
      verify → addAll → commit → pushBranch → comment on PR.

## 2. Dispatcher

- [ ] 2.1 In `src/index.ts`, when intent.kind === "iterate-spec",
      mint installation token + call handleIterateSpec. Existing
      try/catch + error-log pattern.

## 3. CLI

- [ ] 3.1 `src/cli.ts`: new subcommand `handle iterate-spec --pr <n>
      --repo <owner/repo>`. Build Octokit from gh auth token.

## 4. Tests

- [ ] 4.1 Unit tests for handler with helpers mocked: happy path,
      closed-PR abort, missing-metadata abort, verify-fails abort,
      agent-throws path.
- [ ] 4.2 Integration test: mock handler, assert it's called on
      iterate-spec intent and NOT called on noop intents.

## 5. Verify + ship

- [ ] 5.1 `npm run test:all` passes
- [ ] 5.2 `npm run typecheck` passes
- [ ] 5.3 `openspec validate wire-iterate-spec-handler` passes
- [ ] 5.4 Archive in the impl PR before merge
