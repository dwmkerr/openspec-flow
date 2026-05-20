# Design — wire-status-comment-upsert

## The comment lifecycle

```
   webhook arrives
        │
        ▼
  ┌──────────────────────┐
  │ dispatcher           │   👀 react
  │ classifies           │
  │ creates status       │   "👀 received: create-spec. Starting…"
  │ comment              │   ← comment_id captured
  └──────────┬───────────┘
             │  passes statusCommentId + targetNumber to handler
             ▼
  ┌──────────────────────┐
  │ handler runs         │
  │   updates comment at │
  │   milestones via     │   PATCH /issues/comments/{id}
  │   updateStatusComment│
  └──────────┬───────────┘
             │  final patch sets terminal state
             ▼
        comment shows:
        "✅ spec PR opened: #N"
        OR
        "❌ openspec-flow failed: <error>. See dev logs."
```

## Module: `src/handlers/shared/status-comment.ts`

Two functions, both via raw `octokit.request()` (same pattern as
addLabels — bypasses any Probot/plugin v13 quirks):

```ts
createStatusComment(octokit, owner, repo, issueNumber, body) → commentId
updateStatusComment(octokit, owner, repo, commentId, body)   → void
```

Endpoints:

```
POST  /repos/{owner}/{repo}/issues/{issue_number}/comments
PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}
```

`updateStatusComment` is best-effort: catches and logs failures
without throwing. A stale display is a degraded UX, not a
correctness bug.

## Dispatcher behaviour

For actionable intents (`create-spec`, `create-impl`,
`iterate-spec`) AND visible noops:

```ts
const target = targetNumber(payload);  // already computed
const initial = isActionable(intent)
  ? `👀 openspec-flow received: ${summary}. Starting…`
  : summary;
const statusCommentId = await createStatusComment(
  octokit, owner, repo, target, initial,
);
```

Then if actionable, dispatcher calls the handler with the new
opt:

```ts
await handleCreateSpec({
  ...,
  statusCommentId,
  statusTargetNumber: target,
});
```

For visible noops the comment is terminal — no handler runs, no
further updates.

## Handler milestones

Each handler updates the comment at three points (plus failure):

| Milestone | Body template |
|---|---|
| Agent starting | `📖 reading context for issue #{n}…` (or `for PR #{n}…` for iterate) |
| Agent finished | `🔧 agent finished, pushing branch…` |
| Done (success) | `✅ spec PR opened: #{m}` / `✅ impl PR opened: #{m}` / `✅ spec updated` |
| Failure | `❌ openspec-flow failed: <error>. See dev logs.` |

Body content stays plain text; emoji prefix gives at-a-glance state.

## Handler signature change

All three `HandleXOpts` interfaces gain:

```ts
statusCommentId?: number;        // optional so CLI/tests still work
statusTargetNumber?: number;     // (issue or PR number)
```

When omitted (e.g. CLI mode), the handler skips status updates.
Success/failure still goes to stdout for the CLI; the comment
upsert is webhook-mode only. This keeps the CLI clean and avoids
posting comments on real issues during local debugging.

## Why not just update Probot's posted comment?

Probot doesn't post one — our dispatcher does. By moving the
create + capture into the dispatcher, we own the id from the
start and the handler just needs the id to update. No need to
search-by-author or grep-by-content.

## Why visible noops terminal?

A visible noop says "I saw this but won't act". No further state
to update. The single comment is the whole story. Upsert API
calls during a noop would be wasted work.

## Failure terminal state

If a handler throws, its try/catch already builds a failure
message. The catch block now PATCHes the status comment with
that message before re-throwing. The dispatcher's outer try/catch
still logs the stack — error surface unchanged at the log level,
just consolidated at the UI level.

## Edge cases

| Scenario | Behaviour |
|---|---|
| Status comment create fails (transient 422 / 5xx) | Dispatcher logs warn, runs handler without `statusCommentId`. Handler-side updates silently skip. PR open / push still happens. |
| Status comment update fails (token expired mid-run) | `updateStatusComment` swallows. Display stays stale; substantive artefact (PR) is the real signal. |
| Two webhooks arrive within seconds for the same target | Each creates its own status comment. They don't collide. (Future: detect concurrent runs and dedupe — out of scope.) |
| Chained mode's nested create-impl call | Operates on the spec PR, not the originating issue. Creates its OWN status comment on the spec PR. The originating issue's status comment stays at "✅ spec PR opened: #N". |
