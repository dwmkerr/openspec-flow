## 1. Prompt update

- [ ] 1.1 Extend `src/handlers/iterate-spec/prompt.md` with a new step that documents the `.openspec-flow/iteration-replies.json` contract: file path, schema, `<sha>` token substitution, three `kind` values (`done`, `addressed`, `wontfix`), and the "ignore openspec-flow[bot] (including prior inline replies)" rule when selecting `commentId`s.
- [ ] 1.2 Update the existing "ignore openspec-flow[bot]" sentence in the prompt to explicitly include prior inline replies so the agent does not loop on its own past output.

## 2. Shared helper for inline replies, thread resolution, and changelog rendering

- [ ] 2.1 Create `src/handlers/shared/review-replies.ts` exporting:
  - `IterationRepliesFile` TypeScript type matching the JSON schema (replies, resolveThreadIds, changelog).
  - `readIterationReplies(workdir): IterationRepliesFile | null` — returns null on ENOENT (info-log), throws to caller on parse error.
  - `postInlineReplies(octokit, owner, repo, prNumber, replies, log)` — sequential POSTs to `/repos/.../pulls/{pr}/comments/{id}/replies`, each wrapped in best-effort try/catch.
  - `resolveReviewThreads(octokit, threadIds, log)` — sequential GraphQL `resolveReviewThread` mutations, each wrapped in best-effort try/catch.
  - `renderChangelog(entries): string | null` — returns the bullet-list block, or null when entries is empty/absent.
  - `substituteSha(replies, shortSha): IterationReply[]` — pure function that replaces `<sha>` token in reply bodies.
- [ ] 2.2 Add unit tests for `review-replies.ts` covering: missing file → null; malformed JSON → throws; SHA substitution; sequential POSTs with one 404 in the middle continuing; GraphQL error continuing to next threadId; empty changelog → null render; populated changelog → expected markdown.

## 3. Status body extension

- [ ] 3.1 Extend `statusSpecUpdated` in `src/handlers/shared/status-bodies.ts` to accept an optional `changelog: string | null` argument. When non-null, return `✅ spec updated by openspec-flow\n\n**This iteration**\n<changelog>`; otherwise return the existing single-line body.
- [ ] 3.2 Add unit tests for the new branch (with changelog, without changelog, with empty-string changelog treated as null).

## 4. Handler wiring

- [ ] 4.1 In `src/handlers/iterate-spec/index.ts`, after `pushBranch` and before the terminal `setStatus(statusSpecUpdated(...))`, capture the short SHA via `git rev-parse --short HEAD` in the workdir.
- [ ] 4.2 Read `.openspec-flow/iteration-replies.json` via `readIterationReplies`. If null, info-log and pass `null` changelog to `statusSpecUpdated`.
- [ ] 4.3 If present and parseable, substitute `<sha>`, post inline replies, then resolve threads, then render the changelog. Each step wrapped per spec: best-effort, isolated try/catch, warn-logged failures, no re-throw.
- [ ] 4.4 Pass the rendered changelog (or null) to `statusSpecUpdated` so the terminal status body reflects the iteration. Ensure the terminal status update still runs even if all best-effort steps fail.

## 5. Tests

- [ ] 5.1 Extend `src/handlers/iterate-spec/index.test.ts` with cases for: JSON missing (no API calls beyond terminal status), JSON malformed (no API calls, terminal status still posts without changelog), happy path (3 replies posted, 2 threads resolved, changelog appended), one reply 404 (others still post), one GraphQL failure (others still resolve, changelog still appended).
- [ ] 5.2 Verify mocks reflect `octokit.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies", ...)` and `octokit.graphql(...)` shapes used by the shared helper.

## 6. Spec validation and integration

- [ ] 6.1 Run `openspec validate iterate-spec-reply-and-changelog` and confirm it passes.
- [ ] 6.2 Run `npm test` and confirm new + existing tests pass.
- [ ] 6.3 Confirm an end-to-end iterate-spec run on a test fixture PR produces inline replies, resolves the marked threads, and appends the changelog to the sticky status comment (manual smoke once the impl PR is in place).

## 7. Archive

- [ ] 7.1 In the impl PR, run `openspec archive iterate-spec-reply-and-changelog --yes` so the delta merges into `openspec/specs/iterate-spec-handler/spec.md`.
