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

## What Changes

- **BREAKING (UX)**: Replace the per-intent classifier comment in
  `src/index.ts` with a single **sticky status comment** that the dispatcher
  upserts on the target issue or PR.
- The sticky comment SHALL describe the *current* state, not Phase 2 plans.
  Initial state: "openspec is working on this…" with a working indicator
  (animated SVG/GIF served from `public/`, mirroring the claude-action
  pattern). Terminal state: replaced by the handler's outcome comment (spec
  PR opened, impl PR opened, failure linking to run) or by the bot updating
  the sticky body in place with the outcome.
- Identify the sticky comment via an HTML-comment marker
  (`<!-- openspec-flow:status -->`) at the top of the body, so the dispatcher
  can find and update the prior comment instead of posting a duplicate.
- Lifecycle: on each actionable intent, the dispatcher looks up the prior
  sticky comment on the same issue/PR; if found, it `PATCH`es the body; if
  not, it `POST`s a new comment. On terminal state (handler success/failure),
  the sticky is updated one final time with the outcome and the working
  indicator is removed.
- Keep the eyes reaction (it's free and instant) and the prunable
  `openspec-flow-summary` marker convention used by handler-authored summary
  comments. The new status marker is distinct so the two don't collide.

## Capabilities

### New Capabilities
- `status-comment`: the sticky lifecycle comment posted by the Probot
  dispatcher on every actionable intent. Defines the marker, upsert
  semantics, working/terminal states, and the working indicator.

### Modified Capabilities
- `intent-recognition`: the dispatcher's "post the classifier comment"
  requirement (lines 126-145, 175-181 of the current spec) is replaced by
  "upsert the sticky status comment via the `status-comment` capability".
  The eyes reaction requirement is unchanged.

## Impact

- `src/index.ts` — replace the inline `createComment` call in `dispatch`
  with an upsert helper that reads the sticky marker and either patches or
  posts.
- New module under `src/` (e.g. `src/status-comment.ts`) implementing the
  upsert logic; covered by unit tests.
- `public/` — add a working indicator asset (animated SVG preferred; small
  GIF acceptable). Referenced from the comment body by absolute URL to the
  deployed Probot's public assets, or as a raw GitHub URL from the repo.
- `tests/integration/intent.test.ts` — existing assertions on the comment
  body need updating to match the new copy and marker.
- Handlers that currently post their own outcome comment (`create-spec`,
  `create-impl`) may opt into updating the sticky instead of posting a
  fresh one — design.md picks a side.
- No change to the label contract, branch convention, or webhook event
  surface.
