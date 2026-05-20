# Tasks — wire-create-impl-handler

## 1. Shared helpers

- [ ] 1.1 `src/handlers/shared/spec-pr-metadata.ts` —
      `parseSpecPrMetadata(body): SpecPrMetadata | null` reads the
      auto-maintained HTML comment block per `CLAUDE.md`. Tests
      cover present / missing / malformed.
- [ ] 1.2 Extend `src/handlers/create-spec/git.ts` (or add
      `src/handlers/shared/git.ts`) with `checkoutExistingBranch(workdir, branch)`
      for chained mode's "fetch spec branch and check it out"
      workflow.

## 2. create-impl handler

- [ ] 2.1 `src/handlers/create-impl/prompt.md` per the design:
      tight, no identity bloat, three-step instruction
      (apply-change skill → verify-change skill → `openspec archive
      <name> --yes`).
- [ ] 2.2 `src/handlers/create-impl/verify.ts` — post-agent
      checks: change dir gone, archive dir exists, git status
      dirty. Tests cover all three failure cases.
- [ ] 2.3 `src/handlers/create-impl/index.ts` orchestrating:
      clone, preconditions, metadata (sequential) or use passed
      values (chained), agent, verify, branch, commit, push, PR,
      label, comment. Failure surfaces on issue + impl PR (if open).
- [ ] 2.4 Unit tests for handler with all helpers mocked, covering
      both modes and the post-agent verify failure modes.

## 3. Chained-mode hook in create-spec

- [ ] 3.1 At the tail of `handleCreateSpec`, after the success
      comment, if `OPENSPEC_FLOW_CHAINED_MODE=true`, invoke
      `handleCreateImpl({ mode: "chained", ... })` inside its own
      try/catch.
- [ ] 3.2 Update `handleCreateSpec` tests: with chained env var on
      → impl invoked; default → not invoked; impl failure leaves
      spec PR result intact.

## 4. Dispatcher + CLI

- [ ] 4.1 In `src/index.ts`, when the classifier returns a
      `create-impl` intent, mint installation token, call
      `handleCreateImpl({ mode: "sequential", specPrNumber: ... })`.
      Existing try/catch + error log pattern.
- [ ] 4.2 Integration tests: mock the handler, assert it's called
      on spec-PR-merged events and NOT on noop events.
- [ ] 4.3 `src/cli.ts`: new `handle create-impl --pr <spec-pr>
      --repo <owner/repo>` subcommand. Loads octokit from `gh
      auth token`, runs handler in sequential mode.

## 5. Env + docs

- [ ] 5.1 `.env.example` adds
      `OPENSPEC_FLOW_CHAINED_MODE=false` with a comment explaining
      its purpose.
- [ ] 5.2 `CLAUDE.md` Patterns section: document the env var and
      the chained-mode addition to the trigger table.
- [ ] 5.3 `docs/architecture.md`: new "Chained mode" section with
      the stacked-PR diagram + state-detection logic + edge cases
      table.

## 6. Verify + ship

- [ ] 6.1 `npm run test:all` passes
- [ ] 6.2 `npm run typecheck` passes
- [ ] 6.3 `openspec validate wire-create-impl-handler` passes
- [ ] 6.4 Archive in the impl PR before merge
- [ ] 6.5 Local CLI smoke (against a closed spec PR): handler runs,
      opens impl PR, comments on issue.
