## 1. Sticky upsert helper

- [ ] 1.1 Add `src/status-comment.ts` exporting `STATUS_MARKER =
  "<!-- openspec-flow:status -->"`, a `findStatusComment(octokit,
  owner, repo, issueNumber)` lookup, and an
  `upsertStatusComment(octokit, owner, repo, issueNumber, body)`
  helper that PATCHes when a prior sticky exists or POSTs otherwise.
- [ ] 1.2 Add `workingBody({ summary, publicBaseUrl })` and
  `terminalBody(message)` builders. Both prefix the body with
  `STATUS_MARKER` and a newline. `workingBody` emits an `<img
  src="${publicBaseUrl}/working.svg">` when `publicBaseUrl` is set
  and the literal `⏳ working…` otherwise.
- [ ] 1.3 Unit tests in `src/status-comment.test.ts` covering: marker
  is first line; lookup returns matching comment id; lookup returns
  `null` when no comment carries the marker; upsert patches when
  found and posts when not; `workingBody`/`terminalBody` shapes.

## 2. Dispatcher integration

- [ ] 2.1 Replace the inline `createComment` call in `src/index.ts`
  `dispatch(...)` with `upsertStatusComment(...)` called with the
  working body for actionable intents and with the terminal body for
  visible noops.
- [ ] 2.2 Pass an `updateStatus(body: string)` callback into
  `handleCreateSpec` and `handleCreateImpl` that wraps
  `upsertStatusComment(...)` bound to the current
  owner/repo/issueNumber.
- [ ] 2.3 In the dispatcher's `try/catch` around the handler call,
  call `updateStatus` with a terminal failure body that names the
  error and (when available) links the workflow run URL.
- [ ] 2.4 Wrap every sticky upsert in a `try/catch` that logs a
  warning via `context.log.warn(...)` and does not re-throw, so the
  handler always runs.

## 3. Handler outcome wiring

- [ ] 3.1 In `src/handlers/create-spec/index.ts`, accept the new
  `updateStatus` option in `handleCreateSpec` and call it once the
  spec PR is open with `terminalBody(\`openspec opened spec PR:
  #${prNumber}\`)`.
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
- [ ] 5.2 Add an integration test asserting the upsert path: two
  consecutive actionable intents on the same issue produce one
  comment, not two. Use the `octokit` mock to assert one
  `createComment` and one `updateComment` call.
- [ ] 5.3 Update `docs/architecture.md` and `CLAUDE.md` (the project
  one, not user global) to describe the sticky status comment, its
  marker, and the upsert lifecycle, alongside the existing
  `openspec-flow-summary` marker.
- [ ] 5.4 Run `openspec validate sticky-status-comment` and
  `npm test` from the repo root; both green before the PR is
  considered done.
