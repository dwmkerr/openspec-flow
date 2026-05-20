## Why

The dispatcher posts an immediate "fast feedback" comment on every actionable
intent, but its body still reads:

> **Intent:** create specification for issue #N — <title>
>
> _Phase 2 will wire this to the agent. For now this is just the intent
> classifier confirming what would happen._

Phase 2 was wired months ago — the handler runs straight after this comment is
posted. The text is stale and now actively misleads users into thinking the
agent is not running. See issue #30 (and the earlier case linked from it,
issue #26).

A second problem is that this comment never updates. The dispatcher keeps
appending a fresh classifier comment on every iteration, so an issue
accumulates a graveyard of "confirming what would happen" comments while the
real progress (spec PR opened, impl PR opened, failure linking to run) lives
elsewhere. Other agent platforms (e.g. claude-action) show a single sticky
comment that flips through working → done states with an indicator icon.

A third problem — surfaced in PR #31 review — is positional. A user iterates
on an issue or PR by re-applying `openspec:go`, sometimes after a long
discussion thread. If the dispatcher patched the status comment in place, the
freshest status would sit buried deep in the timeline next to the original
post, while the user's eye is at the bottom of the conversation reading their
own latest comment. The status update is invisible. Other bots (e.g.
claude-action, dependabot recreate-flow) sidestep this by **reposting** the
status comment so it always lands at the bottom of the discussion.

## What Changes

- **BREAKING (UX)**: Replace the per-intent classifier comment in
  `src/index.ts` with a single **sticky status comment** that the dispatcher
  reposts on every actionable intent — old sticky deleted, new one posted at
  the bottom of the thread.
- The sticky comment SHALL describe the *current* state, not Phase 2 plans.
  Initial state: "openspec is working on this…" with a working indicator
  (animated SVG/GIF served from `public/`, mirroring the claude-action
  pattern). Terminal state: the sticky body is replaced with the handler's
  outcome (spec PR opened, impl PR opened, failure linking to run).
- Identify the sticky comment via an HTML-comment marker
  (`<!-- openspec-flow:status -->`) at the top of the body, so the dispatcher
  can find any prior sticky on the issue/PR and delete it before posting the
  fresh one.
- Lifecycle ("repost", not "patch in place"): on each actionable intent the
  dispatcher (1) looks up any prior sticky by marker, (2) POSTs a new comment
  carrying the fresh body, and (3) DELETEs the prior sticky once the new one
  is confirmed posted. The state transition from working → terminal *within
  the same handler run* is the one case that stays as an in-place edit (the
  new sticky is already at the bottom; reposting again on success would only
  add noise). The repost-vs-patch rule is: across runs → repost; within a
  single run → patch.
- Keep the eyes reaction (it's free and instant) and the prunable
  `openspec-flow-summary` marker convention used by handler-authored summary
  comments. The new status marker is distinct so the two don't collide.

## Capabilities

### New Capabilities
- `status-comment`: the sticky lifecycle comment posted by the Probot
  dispatcher on every actionable intent. Defines the marker, repost-on-iterate
  + patch-within-run semantics, working/terminal states, and the working
  indicator.

### Modified Capabilities
- `intent-recognition`: the dispatcher's "post the classifier comment"
  requirement (lines 126-145, 175-181 of the current spec) is replaced by
  "repost the sticky status comment via the `status-comment` capability".
  The eyes reaction requirement is unchanged.

## Impact

- `src/index.ts` — replace the inline `createComment` call in `dispatch`
  with a repost helper that finds the prior sticky, posts the new body, then
  deletes the prior one.
- New module under `src/` (e.g. `src/status-comment.ts`) implementing the
  repost + in-run patch logic; covered by unit tests.
- `public/` — add a working indicator asset (animated SVG preferred; small
  GIF acceptable). Referenced from the comment body by absolute URL to the
  deployed Probot's public assets, or as a raw GitHub URL from the repo.
- `tests/integration/intent.test.ts` — existing assertions on the comment
  body need updating to match the new copy, marker, and repost behaviour
  (two iterations on the same issue → one `createComment` per iteration plus
  one `deleteComment` for the prior sticky, NOT a single `updateComment`).
- Handlers that currently post their own outcome comment (`create-spec`,
  `create-impl`) update the sticky in place via the `updateStatus` callback
  — this is the within-run patch case, no repost needed.
- No change to the label contract, branch convention, or webhook event
  surface.
