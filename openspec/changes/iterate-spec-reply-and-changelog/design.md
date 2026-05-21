## Context

`iterate-spec` runs when a reviewer applies `openspec:go` to an open spec PR. The handler clones the repo, hands the PR + issue context to the agent via a prompt, lets the agent rewrite artefacts and commit, force-pushes the branch, then PATCHes the sticky status comment to `✅ spec updated by openspec-flow`.

There is no visible round-trip on the PR. Inline review comments stay unanswered. Threads stay unresolved. A scroll-through reader cannot tell which feedback the bot considered or how it responded — they have to diff. We want each iteration to leave three artefacts on the PR:

1. A reply on every inline review comment the agent considered.
2. A resolved thread for every comment fully addressed.
3. A per-iteration changelog rendered into the sticky status comment.

The repo's architectural pattern (`CLAUDE.md` → "Patterns") says: *agent owns prose, harness owns mechanics*; *don't extract structured data from agent output — the agent emits prose into the workdir; the harness reads filesystem state, never agent reply text*. The design honours that boundary.

## Goals / Non-Goals

**Goals:**
- Every inline review comment the agent considered receives exactly one reply per iteration.
- Threads the agent fully addressed are resolved via GraphQL `resolveReviewThread`.
- The terminal sticky status comment includes a bullet changelog mapping reviewer requests to actions taken.
- Reply / resolve / changelog work is best-effort; failures warn-log and do not block commit, push, or terminal status update.
- Bot keeps ignoring its own comments (including its prior inline replies) — no feedback loops.
- Hand-off between agent and handler is via a filesystem artefact (JSON), not via agent reply text.

**Non-Goals:**
- Replying on the originating issue's comments. The issue is read-only context during `iterate-spec`.
- Replying on `create-spec`. First-pass spec PR has nothing to acknowledge.
- Same behaviour for `iterate-impl`. Same gap exists but is tracked separately; we may lift the shared helper later.
- Rich changelog rendering (tables, images). Bullet list with `@user: request → action` is enough.
- Re-replying to the same comment on subsequent iterations. Each iteration replies to currently-unresolved comments the agent considered this run.

## Decisions

### 1. Agent emits a JSON file in the workdir; handler reads + acts

**Decision:** The agent writes `.openspec-flow/iteration-replies.json` in the workdir before committing. The handler reads it after a successful push and performs the GitHub API calls.

**Shape:**

```jsonc
{
  "replies": [
    { "commentId": 123, "kind": "done",     "body": "Done in <sha>." },
    { "commentId": 124, "kind": "addressed","body": "Addressed — see design.md §2." },
    { "commentId": 125, "kind": "wontfix",  "body": "Won't fix — out of scope per proposal." }
  ],
  "resolveThreadIds": ["PRRT_kwDOAB..."],
  "changelog": [
    { "user": "alice", "request": "multi-line handling", "action": "updated proposal §3, added task 4.2" },
    { "user": "bob",   "request": "tighten failure contract", "action": "revised design.md error table" }
  ]
}
```

The handler substitutes the literal placeholder `<sha>` in any reply body with the short commit SHA from `git rev-parse --short HEAD` after the agent commits. (The agent cannot know its own commit SHA at write time.)

**Why a JSON file, not have the agent post via `gh`:**
- Matches the repo pattern: agent emits filesystem state; handler does API calls.
- Handler can wrap each call in best-effort try/catch, log structured warnings, and continue. Agent-driven calls would lose that.
- Handler knows the commit SHA after `git commit`, so it can substitute `<sha>` deterministically.
- One reply per iteration is enforceable in the handler (idempotency by comment id within the run).

**Alternatives considered:**
- Agent posts replies directly via `gh api`. Rejected: violates the boundary, and the agent can't know its own commit SHA before committing.
- Parse a section of the commit message. Rejected: structured data in prose is exactly what the pattern warns against.
- Agent writes prose-only file the handler parses. Rejected: regex on prose is fragile; JSON is the right tool.

### 2. Changelog rendered into the existing sticky status comment, not a new comment

**Decision:** When the agent provided a non-empty `changelog`, the handler renders it as a Markdown bullet list and appends it to the terminal status body. The terminal body becomes:

```
✅ spec updated by openspec-flow

**This iteration**
- @alice: multi-line handling → proposal §3, tasks.md 4.2
- @bob: tighten failure contract → design.md error table
```

`statusSpecUpdated()` gains an optional `changelog` parameter; when omitted, the body is the existing terminal string unchanged.

**Why the status comment, not a new one-shot reply:**
- The status-comment spec already mandates exactly one sticky comment per actionable intent. A separate one-shot would violate it.
- Readers already look at the sticky comment for state — natural place for the round-trip summary.
- One PATCH instead of one POST.

**Alternatives considered:**
- Separate one-shot PR comment. Rejected: contradicts the "one sticky comment per intent" rule in the `status-comment` spec.
- Edit the PR description. Rejected: PR description carries the metadata block and the proposal summary; iteration churn there is noisy.

### 3. Inline replies use REST `pulls/comments/{id}/replies`; thread resolution uses GraphQL

**Decision:** Inline reply uses `POST /repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies` (creates a reply in the same thread as the parent). Thread resolution uses GraphQL `mutation { resolveReviewThread(input: {threadId: ...}) { ... } }`.

**Why split:** REST has no thread-resolve mutation; GraphQL has no first-class inline-reply mutation that's nicer than the REST one. Standard split. Both use the existing `octokit` instance.

### 4. Best-effort failure semantics, isolated per call

**Decision:** Each reply post, each thread resolve, and the changelog append are wrapped in their own try/catch. A failure logs `iterate-spec: <op> failed: <error>` at warn level and continues. The terminal status update still runs (without the changelog if the JSON file was malformed).

**Why per-call, not one big try/catch:** A single 404 on a deleted comment should not skip the other replies or skip thread resolution.

### 5. Bot ignores its own comments — extended to inline replies

**Decision:** The agent prompt already says "ignore comments authored by `openspec-flow[bot]`". We restate it once and explicitly include inline replies and the changelog under that umbrella. No code change needed beyond the prompt update — the agent surfaces all comment data through `gh` which exposes the `user.login` field.

## Risks / Trade-offs

- **Risk:** Agent writes a malformed JSON file → no replies / no changelog.
  **Mitigation:** Handler parses with `JSON.parse` inside a try/catch, warn-logs the error, and continues to the terminal status update without a changelog. Add a test fixture for malformed JSON.

- **Risk:** Agent omits the JSON file entirely (e.g. on the first deployment with old prompt cached, or if the agent decides nothing was reviewable).
  **Mitigation:** Missing file is not an error. Handler logs `iterate-spec: no iteration-replies.json — skipping replies/resolve/changelog` at info level and proceeds.

- **Risk:** Agent invents a `commentId` that doesn't exist or belongs to another PR.
  **Mitigation:** REST returns 404 → warn-logged and skipped. Test fixture for 404.

- **Risk:** `resolveReviewThread` requires the bot have write access to the PR. App install scopes should already include this; document the scope in `docs/app-setup.md` if not.

- **Risk:** Per-comment replies create noise on large PRs.
  **Mitigation:** Reply bodies are short (one line). The agent is instructed to reply only to comments it actually considered this iteration, not to every historical comment.

- **Risk:** Feedback loop — bot replies to its own previous inline reply.
  **Mitigation:** Existing prompt rule (ignore `openspec-flow[bot]`) extended to inline replies. The `user.login` filter works for replies the same as for top-level comments.

- **Trade-off:** Substituting `<sha>` in the handler couples the agent's reply body to a handler-side placeholder. Acceptable: it's the minimum coupling needed to give replies a working commit link, and the placeholder is a documented contract in the prompt.

## Migration Plan

No data migration. Behavioural change only.

- Ship prompt update + handler logic together. Old prompt → no JSON file → handler skips reply/resolve/changelog → identical behaviour to today. New prompt → JSON file → new behaviour. Safe to roll forward without flag.
- No rollback steps beyond reverting the PR. Sticky status comment terminal body remains valid markdown either way.

## Open Questions

- Should the handler also reply on threads the agent did *not* address (e.g. "I considered this but had nothing to change") to make the round-trip exhaustive? Current scope: no — only acknowledge comments the agent acted on or explicitly declined. Reviewers can iterate again if a comment was missed.
- Should we cap the changelog length on the status comment to keep it scannable on PRs with many comments? Defer — render everything for now, revisit if PRs in the wild hit visual limits.
