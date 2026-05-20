# Tasks — wire-create-spec-handler

## 1. Helpers

- [ ] 1.1 `src/handlers/create-spec/slug.ts` — `branchSlug(title)`
      kebab-case + length cap. Unit tests in `slug.test.ts`.
- [ ] 1.2 `src/handlers/create-spec/workdir.ts` — `createWorkdir(n)`,
      `removeWorkdir(path)`, env-var lookup. Unit tests for naming
      pattern + cleanup respect of `KEEP_WORKDIR`.
- [ ] 1.3 `src/handlers/create-spec/preconditions.ts` —
      `assertOpenSpecCli()`, `assertSkillPresent(workdir)`. Tests
      for both happy + missing cases.
- [ ] 1.4 `src/handlers/create-spec/git.ts` — thin wrappers around
      `execFileSync("git", ...)` for clone, config, checkout, add,
      commit, push. Returns last-line stderr on failure.
- [ ] 1.5 `src/handlers/create-spec/changes.ts` — `listNewChanges(workdir)`
      returns names of new dirs under `openspec/changes/` excluding
      `archive/`.

## 2. Issue context

- [ ] 2.1 `src/handlers/create-spec/context.ts` —
      `gatherIssueContext(octokit, owner, repo, issueNumber)`
      returns a concatenated string with author/timestamp markers.
- [ ] 2.2 Unit test mocks Octokit, asserts ordering + format.

## 3. Prompt

- [ ] 3.1 Rewrite `src/handlers/create-spec/prompt.md`: stub copy
      → real prompt. Vars: `{{issueNumber}}`, `{{issueTitle}}`,
      `{{issueContext}}`. Direct Claude to use
      `openspec-new-change` skill; explicitly NOT to touch git/gh.

## 4. Handler orchestration

- [ ] 4.1 Rewrite `src/handlers/create-spec/index.ts` to:
      1. createWorkdir
      2. clone
      3. preconditions
      4. gatherIssueContext
      5. runAgent (cwd = workdir)
      6. listNewChanges (abort if empty)
      7. derive branch + commit msg
      8. git checkout + add + commit + push
      9. octokit.pulls.create with metadata block + label
     10. octokit.issues.createComment "spec PR opened: #M"
     11. removeWorkdir (unless KEEP)
- [ ] 4.2 Handler signature change: takes `octokit`, `gitPushToken`,
      `issueBody`. Update unit tests.
- [ ] 4.3 Wrap orchestration in try/catch: on error post the single
      failure comment, then re-throw.

## 5. Dispatcher wiring

- [ ] 5.1 In `src/index.ts` pass `context.octokit`, fetch a fresh
      installation token for the git push URL, pass `issueBody`
      from payload.
- [ ] 5.2 Update existing integration test to mock new handler
      signature.

## 6. CLI

- [ ] 6.1 `src/cli.ts` builds Octokit from `gh auth token` for CLI
      mode and passes it + the token to the handler.

## 7. Docs

- [ ] 7.1 `docs/architecture.md` — add a section "create-spec
      handler" with the agent / bot split diagram, the workdir
      lifecycle, and the three auth surfaces.
- [ ] 7.2 `ideas.md` — record `runAgent` allowedTools shape,
      Action-mode clone skip, Bash deny-list hook.

## 8. Verify + ship

- [ ] 8.1 `npm run test:all` passes
- [ ] 8.2 `npm run typecheck` passes
- [ ] 8.3 Local CLI smoke: `openspec-flow handle create-spec
      --issue <N> --repo dwmkerr/openspec-flow` opens a real spec
      PR. Inspect, then close PR + delete branch + `make test-cleanup`.
- [ ] 8.4 Webhook smoke: `gh issue create -l openspec:go,test:fixture`
      against dev repo, watch dev pane, confirm spec PR opens.
- [ ] 8.5 `openspec validate wire-create-spec-handler` passes.
- [ ] 8.6 Archive in the impl PR before pushing.
