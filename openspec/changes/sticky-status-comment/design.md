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

Three problems:

1. The "Phase 2" copy is stale. Handlers (`handleCreateSpec`,
   `handleCreateImpl`) already run synchronously right after this
   `createComment` call, then post their own outcome comments
   ("spec PR opened: #M", failure linking the run).
2. `createComment` always posts a new comment. An issue that the user
   re-triggers with `openspec:go` accumulates a stack of identical
   "confirming what would happen" comments.
3. Even if the dispatcher were changed to edit the *same* comment on every
   iteration (the obvious "upsert" fix), the edited comment stays at its
   original position in the thread. After a few back-and-forth comments
   the freshest status sits buried mid-discussion while the user is
   reading at the bottom — they never see the update. Issue #30's PR
   review (`https://github.com/dwmkerr/openspec-flow/pull/31#issuecomment-4498103199`)
   calls this out and asks for "update and bring to top" semantics
   instead.

Looking at claude-action, dependabot's recreate flow, and similar agent bots:
they keep one logical status comment per run, and on a *new* run they
**repost** rather than edit in place, so the latest status always lands at
the bottom of the conversation. A small animated indicator (GIF/SVG) in the
comment body conveys liveness without any client-side JS.

## Goals / Non-Goals

**Goals:**
- One sticky lifecycle comment visible per actionable intent.
- Body reflects the *current* dispatcher state, never stale "Phase 2"
  language.
- The latest status SHALL always land at the bottom of the thread (i.e.
  the most recent comment), so users iterating with `openspec:go` after
  a long discussion see the status without scrolling back.
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
  `listForRepo`, `updateComment`, `createComment`, `deleteComment`.

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

Page `issues.listComments({ issue_number })` until either a comment
carrying the marker is found (returns the comment id) or the list is
exhausted. For typical issues this is one request. Cap at the first 100
comments to keep the hot path bounded; on the rare issue that has more,
the lookup degrades to "no prior found" and the repost falls through to
just posting a new comment — acceptable (the orphaned prior sticky is
the same situation as today's per-intent comments and the worst case is
one extra dangling comment).

Alternative considered: cache the comment id in a workflow-mode artefact
or in the PR metadata block. Rejected — the dispatcher must also work
for issues (no PR exists yet at `create-spec` time), and adding mutable
state to the issue body for this would entangle the linkage contract
(`CLAUDE.md`).

### Repost vs in-place patch — the "bring to top" decision

GitHub does not allow comments to be reordered; their position in a
thread is fixed by `created_at`. So "bring the status to the top of the
conversation" really means "make the status the *newest* comment" —
which means: delete the old sticky and post a new one.

Two boundaries where the sticky body transitions, with different rules:

| Boundary | Trigger | Strategy | Why |
|---|---|---|---|
| **Across runs** (new `openspec:go` event) | Dispatcher entry | **Repost**: POST new sticky, then DELETE prior sticky | The prior sticky is now buried mid-thread by the intervening discussion. Reposting brings it to the bottom = the user's eye. |
| **Within a run** (working → terminal) | Handler success/failure | **Patch in place**: `updateComment` on the just-posted sticky | The sticky is already at the bottom (the dispatcher just posted it). Reposting again would add a second notification within seconds and pollute the timeline. |

Ordering for the across-runs case: **POST new, then DELETE old**. The
inverse (delete first, post second) opens a window where the issue has
no sticky at all and a concurrent reader sees nothing. Posting first
also means a failed delete leaves the user with two stickies (mild
noise) rather than zero (confusing). The next iteration's lookup
finds the newest sticky and cleans up any stragglers (extend lookup
to collect *all* matches and delete every one but the freshest — see
the dedicated requirement below).

Alternative considered: edit the existing comment in place across runs
(the original PR #31 design). Rejected per reviewer feedback in
#31#issuecomment-4498103199 — the edited comment stays buried and the
update is invisible.

Alternative considered: post a new sticky on every transition (both
across-runs and within-run). Rejected — within a run there's no
buried-comment problem to fix; two stickies seconds apart looks like a
bug to a watching user and double-notifies subscribers.

### Notification handling

Reposting generates one fresh GitHub notification per iteration. This
is acceptable for two reasons:

- The user *triggered* the iteration with `openspec:go`. A notification
  confirming "the bot saw your trigger and is working on it" is
  expected, not spam.
- The notification volume per iteration is the same as today (today the
  dispatcher always POSTs a new classifier comment). Reposting strictly
  improves the signal-to-noise ratio because old, redundant stickies are
  deleted rather than left to accumulate.

The within-run `updateComment` path produces no additional notification
(GitHub does not notify on edits), so the working → terminal transition
stays silent.

### Upsert semantics (within a single run)

```ts
const just_posted_id = await postStatusComment(octokit, owner, repo, num, workingBody);
await runHandler({ updateStatus: (body) =>
  octokit.issues.updateComment({ ..., comment_id: just_posted_id, body })
});
```

The dispatcher captures the comment id of the sticky it just posted and
hands it (via `updateStatus`) to the handler. The handler uses it to
patch the body to the terminal state on success or failure. No lookup
needed inside the handler — the id is closed over.

### Repost semantics (across runs)

```ts
const priorStickies = await findAllStatusComments(octokit, owner, repo, num);
const newId = await octokit.issues.createComment({ ..., issue_number: num, body: workingBody });
for (const prior of priorStickies) {
  if (prior.id === newId) continue; // belt and braces
  await octokit.issues.deleteComment({ ..., comment_id: prior.id })
    .catch((err) => context.log.warn({ err, prior_id: prior.id }, "failed to delete prior sticky"));
}
```

Posting is best-effort, mirroring the eyes reaction. A failed post
logs `context.log.warn(...)` and does not block the handler from
running. A failed delete leaves a dangling prior sticky; the next
iteration's lookup picks it up. Rationale: the comment is UX polish;
the actual work (opening a PR) is what the user is paying attention to.

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
reason (still via the repost path — old sticky deleted, new terminal
sticky posted at the bottom).

### Handler integration

Handlers receive a small `updateStatus(body: string)` callback alongside
their existing `log` injection. The callback is closed over the
just-posted sticky's comment id and calls `octokit.issues.updateComment`
directly. Handlers call it once to flip the sticky to the "done" body
when the outcome is known. They do NOT repost — the within-run path
is patch-in-place by design.

Alternative considered: have handlers continue posting fresh outcome
comments and have the dispatcher poll for those to derive the sticky's
final state. Rejected — too much coupling for a UX feature.

## Risks / Trade-offs

- [Repost across runs generates a new notification each iteration] →
  Accept: one notification per `openspec:go` is the user's
  expectation. Net notification volume is unchanged vs today and the
  signal is cleaner.
- [POST succeeds, DELETE of prior fails → two stickies on the issue]
  → Next iteration's lookup collects all stickies and deletes every
  one but the freshest. Self-healing.
- [DELETE succeeds, POST fails → no sticky on the issue] → Mitigated
  by POST-then-DELETE ordering. Even if POST itself fails, no prior
  sticky was harmed.
- [List-comments pagination misses the sticky if an issue has >100
  comments] → Cap at first page (100). The dispatcher's repost falls
  through to "post fresh" and the prior is left dangling until a
  future iteration catches it.
- [Animated SVG blocked by GitHub's image proxy (Camo)] → Camo passes
  SVG and GIF for both `raw.githubusercontent.com` and arbitrary
  HTTPS hosts. Verified on `public/index.html` already served by the
  Probot. Mitigation: ship a GIF as well; pick whichever Camo serves
  reliably during the impl phase.
- [Existing tests in `tests/integration/intent.test.ts` assert the
  exact "Phase 2 will wire this to the agent" string] → Update those
  assertions. Tracked in tasks.md.
- [Within-run race: handler patches the sticky a second time after a
  concurrent repost from a near-simultaneous `openspec:go`] → The
  patched comment id is the one the *first* dispatcher invocation
  posted; the second invocation will have already deleted it. The
  patch then 404s. Catch and log as warning — the second invocation
  has already produced an up-to-date sticky.

## Migration Plan

1. Add the repost + patch helpers + marker constant, with unit tests.
2. Switch the dispatcher to call the repost helper, replacing the
   `createComment` block. Update existing integration tests in the
   same commit so CI passes mid-flight.
3. Wire `updateStatus` into `handleCreateSpec` and `handleCreateImpl`;
   have them flip the sticky (patch in place) on success/failure.
4. Ship the working-indicator asset and the `PUBLIC_BASE_URL` env
   plumbing.

No data migration required. Pre-existing classifier comments on
historical issues are left in place; they don't carry the new marker
so the repost helper ignores them.

Rollback: revert the commit. The old `createComment` call returns and
the spec's modified requirement reverts in the same archive.

## Open Questions

None blocking. The `PUBLIC_BASE_URL` default and the exact indicator
asset are implementation choices, tracked in tasks.md.
