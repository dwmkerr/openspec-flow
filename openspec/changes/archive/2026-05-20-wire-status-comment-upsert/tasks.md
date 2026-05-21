# Tasks — wire-status-comment-upsert

## 1. Shared module

- [ ] 1.1 `src/handlers/shared/status-comment.ts`:
      `createStatusComment(octokit, owner, repo, issueNumber, body): Promise<number>`,
      `updateStatusComment(octokit, owner, repo, commentId, body): Promise<void>`.
      Both via raw `octokit.request()`. `updateStatusComment`
      catches and logs failures (best-effort).
- [ ] 1.2 `src/handlers/shared/status-comment.test.ts`:
      mock octokit, assert correct endpoint + body shapes; assert
      `updateStatusComment` swallows transient failures.

## 2. Dispatcher

- [ ] 2.1 In `src/index.ts`, replace the existing single-comment
      post with: `createStatusComment(...)` for both actionable
      and visible-noop intents, capture id; for actionable intents
      pass `statusCommentId` + `statusTargetNumber` to the handler.
      Remove the stale "Phase 2 will wire this to the agent" line.
- [ ] 2.2 Integration tests update: assert one comment is posted
      per intent and (for actionable) the handler receives the id
      in its opts.

## 3. Handlers

- [ ] 3.1 All three `Handle*Opts` interfaces gain
      `statusCommentId?: number` and `statusTargetNumber?: number`.
- [ ] 3.2 Each handler updates the comment at three milestones
      (agent-starting, agent-finished, push-complete) and writes
      the terminal state (✅ success or ❌ failure). When opts are
      missing, all status calls are skipped silently.
- [ ] 3.3 Remove the existing `safeComment` / `postIssueComment`
      calls that posted the final separate comment.
- [ ] 3.4 Failure paths PATCH the status comment with the ❌
      message before re-throwing.

## 4. Tests

- [ ] 4.1 Update unit tests for all three handlers: mock the
      status module, assert PATCH called at each milestone +
      terminal state, assert no separate final comment posted.
- [ ] 4.2 Update integration test: only one POST to the comments
      endpoint per actionable intent; subsequent calls are PATCH.

## 5. Ship

- [ ] 5.1 `npm run test:all` passes
- [ ] 5.2 `npm run typecheck` passes
- [ ] 5.3 `openspec validate wire-status-comment-upsert` passes
- [ ] 5.4 Archive in this impl PR; commit, push, open PR with
      `Fixes #30`.
