# Design: unified-sticky-everywhere

## Context

Several prior comments existed on the issue — the lifecycle sticky, a per-target sticky-status, an impl-run breadcrumb. Each lived in different code paths with different markers. The reader saw duplicate/stale info; the writer had to remember which surface to update for which transition.

This change settles on one primitive: a single state, one renderer, mutated by many writers, mirrored across all relevant surfaces (the issue + any open phase PRs).

## Decisions

### D1. One renderer, three options

`renderLifecycleSticky(state, opts, prNumber?)` where `opts = { issueNumber, audience, appInstalled }`. Body content is identical across surfaces; only the header (PR variant only) and the footer hint (App-not-installed only) differ.

### D2. Per-surface lookup markers, shared state marker

Issue uses `<!-- openspec-flow:sticky issue=<n> -->`. PR uses `<!-- openspec-flow:sticky pr=<n> issue=<n> -->`. Both carry the same `<!-- openspec-flow:sticky-state <base64> -->`. Lookup per surface, state shared.

### D3. State lives in the comment body

Base64 JSON in a hidden HTML comment. Same approach as the previous change. No external store. Any writer with read access to a comment can mutate.

### D4. Inline step on active rows

`creating` and `pr-iterating` carry `step?: string`. Rendered as `creating - <step> in workflow #N`. Optional — when absent, row reads as `creating in workflow #N`. Writers can leave it blank for short runs.

### D5. App-installed detection at workflow runtime

Reusable workflow exports `OPENSPEC_FLOW_APP_INSTALLED` env to the Dispatch step. Derived from whether the broker token step or legacy App-secret step produced a token. Handlers read `process.env.OPENSPEC_FLOW_APP_INSTALLED === "true"` at sticky-write time. Probot pre-gate hardcodes `appInstalled: true` because receipt of the webhook proves the App.

### D6. Multi-target writer mirrors to issue + PRs

One mutator call updates every surface where the sticky lives. The mutator reads current state from the issue first, falls back to PRs, then writes to all known surfaces. Identical body modulo audience tag.

## Risks / Trade-offs

- API cost: each mutation now writes to 1 + N surfaces. For typical flows N ≤ 2 (spec PR + impl PR). Two extra writes per transition is invisible against the lifecycle's 5–6 transitions per run.
- Drift risk if a writer mirrors only to a subset of surfaces. Mitigated by the multi-target wrapper being the only public API for stateful updates; single-target version is just a shim.
- Step text is free-form. If a writer sets a stale step that no later writer overrides, the sticky stays at that step until the next mutation. Acceptable — terminal transitions always overwrite.

## Migration

Land. Verify on a single livedown smoke. Follow-up rip-out of the per-target sticky-status path + status-bodies renderers.
