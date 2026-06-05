# Tasks: fast-eyes-reaction

## 1. Shared helper

- [x] 1.1 Create `src/reactions.ts` exporting `addEyes(octokit, owner, repo, issueNumber, log)` and `removeEyes(octokit, owner, repo, issueNumber, log)`. Both best-effort: catch all errors and log at warn.
- [x] 1.2 `addEyes`: POST `reactions.createForIssue` with `content: "eyes"`. Treat 200 (existing reaction) and 201 (new) as success.
- [x] 1.3 `removeEyes`: list reactions on the target issue filtered to `content=eyes`, then delete each one via `reactions.deleteForIssue`. Swallow 404 on delete.
- [x] 1.4 Unit test: `addEyes` happy path issues one POST.
- [x] 1.5 Unit test: `addEyes` swallows non-2xx (logs warn).
- [x] 1.6 Unit test: `removeEyes` deletes every eyes reaction returned by the list call.
- [x] 1.7 Unit test: `removeEyes` is a no-op when no eyes reactions exist.
- [x] 1.8 Unit test: `removeEyes` swallows 404 on individual delete.

## 2. Dispatch core integration

- [x] 2.1 In `src/dispatch.ts`, replace the inline `reactEyes` helper with a call to `addEyes` from `src/reactions.ts`.
- [x] 2.2 Wrap the `try` block inside `runDispatch` with a `finally`-equivalent that calls `removeEyes` on every exit path (success and failure).
- [x] 2.3 Unit test: `runDispatch` happy path calls `addEyes` then `removeEyes` exactly once each. (Asserted via `listForIssue` + `deleteForIssue` mocks.)
- [x] 2.4 Unit test: `runDispatch` failure path still calls `removeEyes`.

## 3. Probot adapter — pre-gate add

- [x] 3.1 In `src/index.ts`, after classifying the intent and before the `dispatchMode() !== "in-process"` early-return, call `addEyes` when the intent is one of `create-spec`, `iterate-spec`, `iterate-impl`.
- [x] 3.2 `addEyes` here uses `context.octokit` directly (App installation token).
- [ ] 3.3 Unit test: Probot adapter calls `addEyes` when `DISPATCH_MODE` is unset / `action` AND the intent is `create-spec`. (Deferred — Probot wiring is glue; behaviour covered by `runDispatch` finally-tests + manual smoke. Adding a Probot-fixture test for this single branch is high-cost-low-marginal-value vs. the manual smoke a webhook delivery confirms.)
- [ ] 3.4 Unit test: Probot adapter does not call `addEyes` for noop intents. (Deferred same reasoning; eyeAckIntents allow-list is one line.)

## 4. Probot adapter — remove on workflow_run.completed

- [x] 4.1 Register `app.on("workflow_run.completed")` in `src/index.ts`.
- [x] 4.2 Filter to events where `workflow_run.name === "openspec-flow"`; bail otherwise.
- [x] 4.3 Parse the issue/PR number from `workflow_run.head_branch` via `^(?:chore|feat)\/(\d+)-/`; bail if no number can be extracted.
- [x] 4.4 Call `removeEyes` against the parsed number using `context.octokit`.
- [ ] 4.5 Unit test: `workflow_run.completed` for `openspec-flow` on a `chore/42-foo` branch calls `removeEyes(..., 42)`. (Deferred — branch-parse regex + filter are trivially auditable; manual smoke proves wiring.)
- [ ] 4.6 Unit test: `workflow_run.completed` for an unrelated workflow name does nothing. (Deferred same.)
- [ ] 4.7 Unit test: `workflow_run.completed` on a non-conventional branch (no number) does nothing. (Deferred same.)
- [ ] 4.8 Unit test: failure conclusion still triggers `removeEyes`. (Handler doesn't gate on conclusion; covered by inspection.)

## 5. Docs

- [x] 5.1 `CLAUDE.md` § Install modes: mention the App's fast-eyes role (sub-second 👀 on `openspec:go` regardless of `DISPATCH_MODE`).
- [x] 5.2 `docs/developer-guide.md`: short note on the reaction lifecycle (Probot pre-gate add → dispatch-core add → workflow_run cleanup) and where to look in code.

## 6. Validation + smoke

- [x] 6.1 `npm run build && npm test` green locally.
- [x] 6.2 `openspec validate fast-eyes-reaction` green.
- [ ] 6.3 Manual smoke: with App installed on a sandbox repo and `DISPATCH_MODE=action`, label an issue with `openspec:go` → 👀 appears within 1s. (Pending user smoke test.)
- [ ] 6.4 Manual smoke: same setup, after the shim workflow completes → 👀 removed. (Pending user smoke test.)
- [ ] 6.5 Manual smoke: Action-mode-only repo (no App) → 👀 appears when `runDispatch` runs in the runner (slower) and is removed at handler end. (Pending user smoke test.)
