## Why

Today `iterate-spec` finishes by updating the sticky status comment to `✅ spec updated by openspec-flow` and nothing else. The reviewer has no visible mapping between what they asked for and what the bot did: inline review threads stay unanswered and unresolved, and the round-trip is invisible to anyone scrolling the PR. Reviewers either re-read the diff to figure out which feedback landed, or chase the bot in comments. We need each iteration to acknowledge feedback inline and summarise the round-trip on the PR.

## What Changes

- `iterate-spec` posts a **reply to every inline review comment** it considered. Reply bodies are short and classified: `Done in <sha>`, `Addressed — see <file>:<line>`, or `Won't fix — <reason>`.
- `iterate-spec` **resolves review threads** it fully addressed via the GitHub GraphQL `resolveReviewThread` mutation. Threads marked `wontfix` or partially-addressed stay open.
- `iterate-spec` appends a **per-iteration changelog** to the sticky status comment when it transitions to its terminal `✅ spec updated` state. The changelog is a bullet list mapping each reviewer request to the action taken (e.g. `@alice: multi-line handling → proposal.md §3, tasks.md 4.2`).
- The agent emits the reply/resolve/changelog plan as a JSON file in the workdir (`.openspec-flow/iteration-replies.json`); the handler reads that file after the agent commits and performs the GitHub API calls. This preserves the "agent owns prose, harness owns mechanics" boundary.
- Reply/resolve/changelog work is **best-effort**: any failure (transient network, missing permission, deleted comment, malformed JSON) is warn-logged and does not block the commit, push, or terminal status update.
- The agent continues to ignore comments authored by `openspec-flow[bot]` — including its own prior inline replies — so there is no feedback loop.

Scope is `iterate-spec` only. `iterate-impl` has the same gap but is tracked separately (see `ideas.md`).

## Capabilities

### New Capabilities

None. Reply/resolve/changelog behaviour belongs to the existing `iterate-spec-handler` capability.

### Modified Capabilities

- `iterate-spec-handler`: adds requirements for inline reply, thread resolution, per-iteration changelog rendering, and the agent → handler JSON hand-off contract. Best-effort failure semantics for those new steps are also specified here.

## Impact

- `src/handlers/iterate-spec/prompt.md`: instruct the agent to record reply intent + changelog into `.openspec-flow/iteration-replies.json` before committing.
- `src/handlers/iterate-spec/index.ts`: after a successful push, read the JSON file, post inline replies (REST `pulls/comments/{id}/replies`), resolve threads (GraphQL `resolveReviewThread`), and append the rendered changelog to the terminal status body. Wrap each call in best-effort try/catch.
- `src/handlers/shared/status-bodies.ts`: extend `statusSpecUpdated()` to accept an optional changelog block.
- New shared helper (e.g. `src/handlers/shared/review-replies.ts`) for the REST + GraphQL calls so `iterate-impl` can reuse it later.
- New test fixtures covering: replies posted, threads resolved, changelog appended, JSON missing, JSON malformed, REST 404, GraphQL error.
- No new dependencies. Continues to use the existing `octokit` instance and `GH_TOKEN`.
