## Why

The originating issue is the human's home timeline, but openspec-flow only comments on it once — "✅ spec PR opened: #N" — then the issue goes silent and auto-closes when the impl PR merges. There is no breadcrumb for spec-merged, impl-opened, or impl-merged. A reviewer watching the issue sees a spec PR link and then, later, a closed issue, with nothing in between.

## What Changes

- A single **lifecycle comment** on the originating issue, marked with `<!-- openspec-flow:lifecycle -->`, **upserted** at each lifecycle transition into a growing checklist:

  ```
  openspec-flow — lifecycle for this issue
  - ✅ spec PR opened — #61
  - ✅ spec PR merged
  - ✅ impl PR opened — #62
  - ✅ implemented & merged — #62 (issue closed)
  ```

- Per-PR "working…" status stickies are unchanged — they remain the live progress signal during each handler run. The lifecycle comment is the durable issue-level trail.
- **Stamp points**:
  - `create-spec` seeds the lifecycle comment (`spec PR opened`).
  - `create-impl` updates it (`spec PR merged` + `impl PR opened`), resolving the issue from the spec-PR metadata block.
  - The impl-PR merge, today a silent noop, becomes a new `finalize-impl` intent whose handler stamps the terminal line (`implemented & merged — issue closed`).

- **BREAKING (classifier)**: `pull_request.closed` + `merged: true` on an `openspec:impl` PR now classifies as `finalize-impl` instead of a silent noop.

## Capabilities

### New Capabilities

- `issue-lifecycle-comment`: the upserted lifecycle checklist contract — marker, render rules, the three stamp points, and the `finalize-impl` handler behaviour.

### Modified Capabilities

- `intent-recognition`: the impl-PR-merge case classifies as `finalize-impl` (was a silent noop); drop that bullet from the silent-noop requirement and add a finalize-impl classification requirement.

## Impact

- **Affected code**:
  - new `src/handlers/shared/lifecycle-comment.ts` (render + marker-keyed upsert on the issue)
  - new `src/handlers/finalize-impl/index.ts` (+ registry entry)
  - `src/intent.ts` (new `finalize-impl` intent + classification)
  - `src/handlers/create-spec/index.ts` (seed lifecycle)
  - `src/handlers/create-impl/index.ts` (update lifecycle on the issue)
  - `src/handlers/registry.ts` (finalize-impl)
- **Affected docs**: root `CLAUDE.md` trigger table (impl-merge → finalize-impl).
- **Behaviour**: the issue gains a durable, upserted breadcrumb across the whole lifecycle. Best-effort: a failed lifecycle upsert warns, never blocks the substantive work.
