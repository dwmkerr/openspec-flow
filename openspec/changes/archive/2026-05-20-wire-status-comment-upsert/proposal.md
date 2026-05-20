## Why

Right now the bot posts two-to-three separate comments per
actionable intent:

1. The classifier comment (`**Intent:** create specification...
   Phase 2 will wire this to the agent...`)
2. A handler-side comment naming what happened
   (`spec PR opened: #N`, `impl PR opened: #N`,
   `spec updated by openspec-flow`, or
   `❌ openspec-flow couldn't ...`)

Two problems:

- **The classifier text is stale.** "Phase 2 will wire this to
  the agent" was true when handlers were stubs. It's a lie now —
  handlers are wired, the agent IS running, and the comment
  misrepresents what's happening.
- **The UX feels disjoint.** Reviewers see a wall of comments
  growing on the issue / PR over time. The Claude action pattern
  is one sticky comment that mutates from receipt → working →
  done, so the reviewer can scroll the issue once and see exactly
  what state the bot is in.

This change consolidates the comment stream into one upserted
status comment per actionable intent.

## What Changes

- **New shared module `src/handlers/shared/status-comment.ts`**:
  `createStatusComment(octokit, owner, repo, target, body)` →
  `commentId`; `updateStatusComment(octokit, owner, repo,
  commentId, body)` patches `/repos/{owner}/{repo}/issues/comments/{id}`.
- **Dispatcher creates the status comment** for every actionable
  intent (`create-spec`, `create-impl`, `iterate-spec`) AND for
  visible noops (so the user still sees one acknowledgement). The
  initial body says what's about to happen, NOT what's been
  wired ("Phase 2..." is gone):
  - actionable: `👀 openspec-flow received: <intent>. Starting…`
  - visible noop: `${reason}` (no upsert later — noop is terminal)
- **Dispatcher passes `statusCommentId` and `targetNumber` to
  handlers** via the existing opts shape.
- **Handlers update the status comment at milestones** instead of
  posting new ones:
  - on start: `📖 reading issue context…`
  - after agent: `🔧 agent finished, preparing branch…`
  - after push: `✅ spec PR opened: #N` (or impl PR, or `✅ spec
    updated`)
  - on failure: `❌ openspec-flow failed: <error>. See dev logs.`
- **Result: one comment per intent.** A reviewer scrolling the
  issue or PR sees a single up-to-date status, not a thread.
- **Failure-comment paths consolidate.** The current `❌ openspec-flow
  couldn't open a spec PR: …` comments become the final body of
  the upserted comment. Same content, same failure surface, one
  comment to read.

## Capabilities

### New Capabilities

- `status-comment`: contract for the single-upserted-comment
  pattern. Defines create + update endpoints, body templates per
  milestone, and the failure terminal-state.

### Modified Capabilities

- `intent-recognition`: dispatcher creates a status comment per
  actionable intent / visible noop, replacing the old
  classifier-comment behaviour. Passes the comment id to handlers.
- `create-spec-handler`, `create-impl-handler`,
  `iterate-spec-handler`: each handler accepts `statusCommentId`
  and `targetNumber`, updates the comment at milestones, and no
  longer posts a separate final comment.
- `openspec-flow`: the user-facing flow is now one sticky comment
  per intent instead of a comment thread.

## Impact

- New: `src/handlers/shared/status-comment.ts` +
  `status-comment.test.ts`.
- Modified: `src/index.ts` (creates comment, passes id);
  all three `src/handlers/*/index.ts` (accept + update);
  unit tests.
- No new deps.
- Cost: same number of API calls overall (one POST to create + N
  PATCHes instead of one POST + N POSTs). PATCH is cheaper than
  POST against rate limits.

## Out of scope

- Animated GIF / spinner in the comment — GitHub markdown can
  embed a GIF URL, but we'd need to host one. Recorded in
  `ideas.md` if we want it.
- Comment reactions on the status comment itself (👀 already lives
  on the issue/PR).
- Cross-PR status tracking (e.g. spec PR comment links to impl PR
  comment) — could be a follow-up using the metadata block.
- Replaying older issues / PRs that have the stale 2-comment
  history — they stay as-is.
- The failure comment in `create-spec`'s chained-mode-impl-failed
  warn-log — that stays separate, not part of the status comment,
  because chained impl runs on a different target (the spec PR
  that was just opened, not the originating issue).
