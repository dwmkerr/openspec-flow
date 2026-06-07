# Design: bot-pregate-sticky-status

## Context

We already extended the pre-gate pattern from eyes to the create-impl issue breadcrumb. Sticky status comment is the third surface and the last big "30-second silence" gap in the flow.

The primitives are in place: `comment-upsert.ts` does marker-based list-then-edit-or-create; `issue-breadcrumb.ts` is the working precedent. This change is glue: wrap the primitive for sticky semantics, swap the dispatch core's create call for the upsert call, and add a pre-gate posting site in the Probot adapter.

## Goals / Non-Goals

**Goals:**
- Sub-second sticky `received` on the target issue/PR for every actionable lifecycle intent.
- Workflow upsert finds the bot's comment and edits — single comment, no duplicates.
- Action-mode-only repos keep working (workflow creates the sticky when nothing's there).

**Non-Goals:**
- Mid-agent-run progress updates. Tracked separately; the bot pre-gate covers the bigger latency win (every intent, not just the long-running ones).
- Iterating-style "same intent re-applied" sharing markers with the prior sticky. Each new label-application gets a fresh sticky for that intent — already the current behaviour via the per-(intent, target) marker.

## Decisions

### D1. Marker shape per (intent, target)

**Decision**: `<!-- openspec-flow:sticky intent=<kind> target=<n> -->`. Iterating the same PR twice produces two markers because the intent is included (`iterate-spec` re-applied = same intent kind but new run — see D2).

**Alternatives**:
- Marker per target only. Rejected — collapses iterate runs into the previous sticky; user loses the "fresh state" signal.
- Marker per intent + payload hash. Rejected — over-engineered for the rare collision.

### D2. Iterate runs get a fresh sticky

**Decision**: today each iteration of `iterate-spec` on the same PR opens a fresh sticky because the workflow's `createStatusComment` always POSTed. With the upsert, the marker is the same (same intent, same target), so iterating WOULD edit the previous sticky instead of creating fresh.

This is acceptable. The sticky's purpose is "current state of the latest run". A reviewer who re-applies `openspec:go` to iterate expects the comment to reflect the new run, not a stale "✅ opened" from the last one. The upsert overwrites; behaviour is what users want.

If we ever decide otherwise, we can include a run-id field in the marker.

### D3. Pre-gate intents = `create-spec` + `iterate-spec` + `iterate-impl` + `create-impl`

**Decision**: same set as `eyeAckIntents` plus `create-impl`. We don't gate eyes for `create-impl` (it fires on merge, not label) — but the sticky DOES apply because the target is the spec PR (= merge event target) and the user benefits from immediate "starting" feedback there too.

### D4. `createStatusComment` is removed from the dispatch hot path

**Decision**: dispatch core switches entirely to `upsertStickyComment`. The old `createStatusComment` helper is no longer called by `runDispatch`. It remains in the codebase only because no other caller currently exists; can be deleted in a follow-up if not adopted by handlers.

**Why**: two parallel code paths (create vs upsert) for the same surface invite divergence. Upsert subsumes create (no marker found → POST). One path, one bug surface.

### D5. The marker is appended to the body if the renderer omits it

**Decision**: `upsertStickyComment` checks `body.includes(marker)`. If absent, appends `\n\n${marker}` before forwarding. Callers (`runDispatch`, the pre-gate handler) can stay unaware of the marker syntax.

## Risks / Trade-offs

- **Risk**: marker-based upsert lists up to 100 comments. On extremely high-traffic issues (>100 comments), the sticky might not be found and a duplicate posted. → **Mitigation**: same as breadcrumb — openspec-flow comments land early; pagination can land if real volume surfaces.
- **Trade-off**: dispatch hot path now does `1 list + 1 patch` instead of `1 post`. Two GitHub API calls vs one. Per-event cost is invisible; bot's pre-gate also pays this once.
- **Trade-off**: dual mode means transiently two writers post the same body. Workflow's edit-after-create just rewrites the same content (modulo run-link); zero user-visible difference.

## Migration Plan

1. Land code (this change).
2. Smoke against a sandbox repo with the dev App installed: label an issue → sticky appears within 1s, then workflow upserts ~30s later with the run-link line added.
3. No data migration needed — old stickies on existing issues stay; new ones use the new marker.

**Rollback**: revert. Dispatch core falls back to create-only via the old path (after restoring `createStatusComment`).

## Open Questions

- **Q1**: Should we delete `createStatusComment` outright once this lands? Leaning yes after a release cycle.
- **Q2**: Mid-agent progress updates (tool-call streaming). Deferred. Larger scope.
