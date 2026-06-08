# consolidated-sticky-status

## Why

The issue page accumulated two overlapping comments — the lifecycle checklist (`spec PR opened ☑ / merged ☐ / impl PR opened ☐ / …`) and the impl-run breadcrumb (`impl run starting…` → `✅ impl PR opened`). Once the workflow completes both surface the same information. The user has to read two comments to learn the same thing. We need one comment that:

- describes the current state in plain English ("openspec-flow is iterating on the implementation."),
- tells the user what to do next ("Merge it to close this issue, or comment and apply `openspec:go` to iterate."),
- shows where the work is happening (workflow link, inline in the table row that's active),
- carries the run badge while active (GIF) and drops it when terminal.

## What Changes

- **New**: `src/handlers/shared/lifecycle-sticky.ts` — pure renderer (`renderLifecycleSticky`) + helpers. Verbs are `preparing` (pre-gate, no run yet), `creating` (first pass), `iterating` (re-run from comments). PR refs render as explicit markdown links. Workflow link lives in the table row, not the headline.
- **New**: `mutateLifecycleSticky(...)` — read-modify-write helper that finds the existing sticky on the issue, parses the embedded base64 JSON state from the comment, applies the caller's mutator, and upserts the result. Lets multiple writers (Probot adapter pre-gate; create-spec handler; create-impl handler; finalize-impl handler) collaborate on one comment without exchanging in-memory state.
- **New**: `src/handlers/shared/resolve-issue.ts` — maps any actionable intent → originating issue number. For `iterate-spec` / `iterate-impl` this reads the PR body's metadata block.
- **New**: Probot adapter pre-gate calls `mutateLifecycleSticky` for all four lifecycle intents — `create-spec` / `iterate-spec` / `iterate-impl` / `create-impl` — and seeds / advances the right phase row.
- **New**: workflow handlers (`create-spec`, `create-impl`, `finalize-impl`) mutate the same sticky at their terminal points (PR open, PR merged, failed).
- **Migration safety**: legacy `upsertLifecycleComment` (checklist) and `upsertImplBreadcrumb` calls are kept for now (double-write). Once the new sticky is verified end-to-end we can remove them in a follow-up.
- **New**: `scripts/preview-sticky.mjs` — renders every state of the sticky to PNGs in `docs/previews/` via Playwright. Same renderer the runtime uses — no separate "preview" data path. README will use these previews as the lead "how it works" surface in a follow-up doc change.

## Capabilities

### Modified Capabilities

- `status-feedback`: the issue-level comment representing the flow's lifecycle becomes the consolidated sticky rendered by `renderLifecycleSticky`. The shape of the comment, the verbs, and the mutator-based write path are all part of the contract.

## Impact

- `src/handlers/shared/lifecycle-sticky.ts` (new) — renderer + state + mutator.
- `src/handlers/shared/lifecycle-sticky.test.ts` (new) — covers every state + the embedded state marker round-trip.
- `src/handlers/shared/resolve-issue.ts` (new).
- `src/index.ts` — adds the `maybeMutateLifecycleSticky` pre-gate.
- `src/handlers/create-spec/index.ts`, `create-impl/index.ts`, `finalize-impl/index.ts` — call `mutateLifecycleSticky` at PR-open / PR-merged / failed transitions, alongside the existing legacy writers (double-write during migration).
- `scripts/preview-sticky.mjs` (new) — Playwright-based preview generator. Output: `docs/previews/*.png` + `index.html`. Same renderer feeds both the runtime and the preview.
- No new App permissions; reuses `Issues: write`.
- README rebuild to use the previews as the lead "how it works" surface is a follow-up change; not in scope here.
