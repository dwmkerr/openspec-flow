## Context

The dispatcher in `src/index.ts` posts a hard-coded comment after the eyes
reaction:

```ts
const body =
  intent.kind === "noop"
    ? `${summary}`
    : `**Intent:** ${summary}\n\n_Phase 2 will wire this to the agent. For now this is just the intent classifier confirming what would happen._`;

await context.octokit.issues.createComment({ ..., body });
```

Two problems:

1. The "Phase 2" copy is stale. Handlers (`handleCreateSpec`,
   `handleCreateImpl`) already run synchronously right after this
   `createComment` call, then post their own outcome comments
   ("spec PR opened: #M", failure linking the run).
2. `createComment` always posts a new comment. An issue that the user
   re-triggers with `openspec:go` accumulates a stack of identical
   "confirming what would happen" comments.

Looking at claude-action and similar agent bots: they post one comment per
run and *update it in place* as state transitions (queued → working → done).
A small animated indicator (GIF/SVG) in the comment body conveys liveness
without any client-side JS.

## Goals / Non-Goals

**Goals:**
- One sticky lifecycle comment per actionable intent, upserted in place.
- Body reflects the *current* dispatcher state, never stale "Phase 2"
  language.
- Visible "working" indicator while the handler is running; replaced by an
  outcome line on completion.
- Reuse the existing eyes-reaction codepath unchanged.
- Cleanly identify the sticky comment via an HTML-comment marker, distinct
  from the existing `<!-- openspec-flow-summary -->` marker used by the
  workflow-mode summary comments.

**Non-Goals:**
- Changing the workflow-mode action's `openspec-flow-summary` prune
  convention. That convention covers handler-authored summaries; this
  change is about the dispatcher's lifecycle comment.
- Real-time progress streaming inside the comment body (no
  long-polling, no edits per agent chunk). The sticky transitions only
  on dispatcher → handler boundaries.
- Removing the per-handler outcome comments (`spec PR opened: #M`,
  failure linking to run). They stay where they are; the sticky just
  links to them once they exist.
- Adding new dependencies. Octokit's issues API already exposes
  `listForRepo`, `updateComment`, `createComment`.

## Decisions

### Marker format

Use `<!-- openspec-flow:status -->` as the first line of the sticky body.

- Distinct from `<!-- openspec-flow-summary -->` so the workflow-mode
  prune step (`docs/architecture.md` and the
  `openspec-flow-composite-actions` spec) does not delete the
  dispatcher's sticky.
- HTML comment hidden from rendered Markdown, machine-readable, persists
  with the comment.
- Single line at the top simplifies lookup: `body.startsWith(MARKER)` or
  a `body.includes(MARKER)` check on each iterated comment.

Alternative considered: store the marker in the comment's `node_id`
metadata. Rejected — GitHub gives no comment metadata sidechannel, and
the App bot already uses body markers elsewhere.

### Lookup strategy

Page `issues.listComments({ issue_number })` until either the marker is
found (returns the comment id) or the list is exhausted. For typical
issues this is one request. Cap at the first 100 comments to keep the
hot path bounded; on the rare issue that has more, the sticky degrades
to "post fresh" — acceptable.

Alternative considered: cache the comment id in a workflow-mode artefact
or in the PR metadata block. Rejected — the dispatcher must also work
for issues (no PR exists yet at `create-spec` time), and adding mutable
state to the issue body for this would entangle the linkage contract
(`CLAUDE.md`).

### Upsert semantics

```ts
const existing = await findStatusComment(octokit, owner, repo, num);
if (existing) {
  await octokit.issues.updateComment({ ..., comment_id: existing.id, body });
} else {
  await octokit.issues.createComment({ ..., issue_number: num, body });
}
```

Posting is best-effort, mirroring the eyes reaction. A failed upsert
logs `context.log.warn(...)` and does not block the handler from
running. Rationale: the comment is UX polish; the actual work
(opening a PR) is what the user is paying attention to.

### Working indicator

Ship a small animated SVG at `public/working.svg` (under 4 KB).
Reference it from the comment body via the deployed Probot's public
URL (configured via `PUBLIC_BASE_URL` env var with a sensible
default for dev). GitHub renders inline `<img>` tags in Markdown,
including animated SVG and GIF.

Fallback: if `PUBLIC_BASE_URL` is unset, omit the image and use a
text indicator ("⏳ working…"). The comment is still informative.

Alternative considered: host the asset on the openspec-flow homepage
(GitHub Pages). Rejected for now — the Probot already serves
`public/` and adding a second hosting surface is one more thing to
keep in sync. Re-evaluate when the App is GA.

### Comment body templates

Two body shapes, switched by handler state:

1. **Working** (posted as the dispatcher hands off to the handler):
   ```
   <!-- openspec-flow:status -->
   ![working](<indicator-url>) **openspec** is working on this…

   Intent: <human-readable summary from describe(intent)>
   ```

2. **Done** (written by the handler once the outcome is known, or by
   the dispatcher's error handler on failure):
   ```
   <!-- openspec-flow:status -->
   openspec opened spec PR: #M
   ```
   or:
   ```
   <!-- openspec-flow:status -->
   openspec failed — see <run-url> for details.
   ```

Visible-noop intents (e.g. `openspec:go` on a closed issue) skip the
working state and write a terminal-only sticky containing the noop
reason.

### Handler integration

Handlers receive a small `updateStatus(body: string)` callback alongside
their existing `log` injection. They call it to flip the sticky to the
"done" body once the outcome is known. The callback is a thin wrapper
around the same upsert helper used by the dispatcher.

Alternative considered: have handlers continue posting fresh outcome
comments and have the dispatcher poll for those to derive the sticky's
final state. Rejected — too much coupling for a UX feature.

## Risks / Trade-offs

- [Sticky update lost due to race between two near-simultaneous
  `openspec:go` events] → Upsert is idempotent on body; the second
  event overwrites the first's body. Worst case is a flicker, not data
  loss. Accept.
- [List-comments pagination misses the sticky if an issue has >100
  comments] → Cap at first page (100) and fall back to "post fresh".
  Rare; the sticky will reconverge on the next iteration.
- [Animated SVG blocked by GitHub's image proxy
  (Camo)] → Camo passes SVG and GIF for both `raw.githubusercontent.com`
  and arbitrary HTTPS hosts. Verified on `public/index.html` already
  served by the Probot. Mitigation: ship a GIF as well; pick whichever
  Camo serves reliably during the impl phase.
- [Existing tests in `tests/integration/intent.test.ts` assert the
  exact "Phase 2 will wire this to the agent" string] → Update those
  assertions. Tracked in tasks.md.

## Migration Plan

1. Add the upsert helper + marker constant, with unit tests.
2. Switch the dispatcher to call the helper, replacing the
   `createComment` block. Update existing integration tests in the
   same commit so CI passes mid-flight.
3. Wire `updateStatus` into `handleCreateSpec` and `handleCreateImpl`;
   have them flip the sticky on success/failure.
4. Ship the working-indicator asset and the `PUBLIC_BASE_URL` env
   plumbing.

No data migration required. Pre-existing classifier comments on
historical issues are left in place; they don't carry the new marker
so the upsert helper ignores them.

Rollback: revert the commit. The old `createComment` call returns and
the spec's modified requirement reverts in the same archive.

## Open Questions

None blocking. The `PUBLIC_BASE_URL` default and the exact indicator
asset are implementation choices, tracked in tasks.md.
