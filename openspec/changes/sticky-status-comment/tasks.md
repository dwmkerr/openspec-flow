## 1. Sticky repost + patch helpers

- [ ] 1.1 Add `src/status-comment.ts` exporting `STATUS_MARKER =
  "<!-- openspec-flow:status -->"`, a `findStatusComments(octokit,
  owner, repo, issueNumber)` lookup that returns *every* prior sticky
  on the first 100 comments (not just the first), and a
  `repostStatusComment(octokit, owner, repo, issueNumber, body)`
  helper that POSTs a new comment first, returns its id, then DELETEs
  every prior sticky in best-effort mode (catch + warn per failure).
- [ ] 1.2 Add `patchStatusComment(octokit, owner, repo, commentId,
  body)` — a thin wrapper around `octokit.issues.updateComment` used by
  the within-run terminal transition. This is the only path that edits
  a sticky in place; never call it from the dispatcher's per-intent
  entry.
- [ ] 1.3 Add `workingBody({ summary, publicBaseUrl })` and
  `terminalBody(message)` builders. Both prefix the body with
  `STATUS_MARKER` and a newline. `workingBody` emits an `<img
  src="${publicBaseUrl}/working.svg">` when `publicBaseUrl` is set
  and the literal `⏳ working…` otherwise.
- [ ] 1.4 Unit tests in `src/status-comment.test.ts` covering:
  - marker is the first line of every emitted body;
  - `findStatusComments` returns every comment carrying the marker,
    in chronological order, and `[]` when none match;
  - `repostStatusComment` calls `createComment` exactly once and
    `deleteComment` once per prior, in that order;
  - a failing `deleteComment` is caught + logged and does not stop
    subsequent deletes;
  - a failing `createComment` is caught + logged and `deleteComment`
    is *not* called (no new sticky → keep priors);
  - `patchStatusComment` calls `updateComment` with the given id and
    body and rethrows nothing on 404 (it logs + swallows).

## 2. Dispatcher integration

- [ ] 2.1 Replace the inline `createComment` call in `src/index.ts`
  `dispatch(...)` with `repostStatusComment(...)` called with the
  working body for actionable intents and with the terminal body for
  visible noops. Capture the returned sticky id in a local
  (`newStickyId`).
- [ ] 2.2 Build an `updateStatus(body: string)` callback that calls
  `patchStatusComment(octokit, owner, repo, newStickyId, body)`. Pass
  it into `handleCreateSpec` and `handleCreateImpl`.
- [ ] 2.3 In the dispatcher's `try/catch` around the handler call,
  call `updateStatus` with a terminal failure body that names the
  error and (when available) links the workflow run URL. Do not
  repost here — the sticky is already at the bottom; patching is
  correct.
- [ ] 2.4 Wrap the repost call in a `try/catch` that logs a warning
  via `context.log.warn(...)` and does not re-throw, so the handler
  always runs.

## 3. Handler outcome wiring

- [ ] 3.1 In `src/handlers/create-spec/index.ts`, accept the new
  `updateStatus` option in `handleCreateSpec` and call it once the
  spec PR is open with `terminalBody(\`openspec opened spec PR:
  #${prNumber}\`)`. Do not repost; the dispatcher's repost has
  already happened.
- [ ] 3.2 In `src/handlers/create-impl/index.ts`, do the same: accept
  `updateStatus` and call it with the impl PR number when the impl PR
  is open.
- [ ] 3.3 Decide whether the per-handler outcome comment posted today
  ("spec PR opened: #M") stays alongside the sticky or is removed
  now that the sticky covers the same information. Default: keep
  both for one release cycle, then remove the redundant comment in a
  follow-up change.

## 4. Working indicator asset

- [ ] 4.1 Add `public/working.svg` — an animated SVG under 4 KB
  rendering a spinner. Verify it renders inline in a GitHub-rendered
  Markdown comment.
- [ ] 4.2 Confirm the existing Probot static handler in
  `src/server.ts` (or wherever `public/index.html` is served) serves
  `public/working.svg` at `/working.svg`.
- [ ] 4.3 Add `PUBLIC_BASE_URL` to the environment schema and the
  example `.env`. Default to unset; document the fallback behavior
  in `docs/app-setup.md`.

## 5. Tests + docs

- [ ] 5.1 Update `tests/integration/intent.test.ts` assertions that
  match the old "Phase 2 will wire this to the agent" string. New
  assertions check that the body starts with the status marker and
  contains either the liveness indicator or the `⏳ working…`
  fallback.
- [ ] 5.2 Add an integration test asserting the **repost** path: two
  consecutive actionable intents on the same issue produce two
  `createComment` calls and one `deleteComment` call (the second
  iteration deletes the first iteration's sticky). Assert there is
  exactly one sticky on the issue at the end (the most recent one).
- [ ] 5.3 Add an integration test asserting the **patch-in-place**
  path: a single actionable intent posts the working sticky once,
  the handler calls `updateStatus`, and the result is exactly one
  `createComment` call plus one `updateComment` call on the same
  comment id — no second `createComment` for the terminal state.
- [ ] 5.4 Add an integration test asserting **straggler cleanup**:
  seed an issue with two comments carrying the status marker, fire
  one actionable intent, assert that exactly two `deleteComment`
  calls and one `createComment` call happen, and the issue ends
  with exactly one sticky.
- [ ] 5.5 Update `docs/architecture.md` and `CLAUDE.md` (the project
  one, not user global) to describe the sticky status comment, its
  marker, the **repost-at-dispatcher / patch-within-run** lifecycle,
  and the "bring to top" rationale, alongside the existing
  `openspec-flow-summary` marker.
- [ ] 5.6 Run `openspec validate sticky-status-comment` and
  `npm test` from the repo root; both green before the PR is
  considered done.
