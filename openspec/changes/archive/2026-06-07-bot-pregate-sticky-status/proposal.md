# bot-pregate-sticky-status

## Why

The sticky status comment is the canonical "what is openspec-flow doing right now" surface. Today it's created at the entry of `runDispatch` — which only runs once the shim workflow has spun up (30+ seconds after the trigger). Meanwhile the user sees:

- t≈1s: 👀 reaction (bot pre-gate)
- t≈1s: issue early breadcrumb (bot pre-gate, create-impl only)
- t≈30s+: sticky "received: …" finally appears

The 30-second silence between "ack" and "status" feels broken. We already have the marker-based upsert primitive (`comment-upsert.ts`); extend the pre-gate pattern from breadcrumb to sticky.

## What Changes

- **New**: `src/handlers/shared/sticky-status.ts` — `stickyMarker(intentKind, target)` + `upsertStickyComment(...)` wrapping the existing `upsertCommentByMarker` primitive. Marker shape: `<!-- openspec-flow:sticky intent=<kind> target=<n> -->`. Each (intent, target) pair gets a fresh marker so iterating a PR opens a new sticky instead of mutating the previous one.
- **Modified**: Probot adapter posts the sticky `received` body pre-gate for any actionable lifecycle intent — `create-spec` / `iterate-spec` / `iterate-impl` / `create-impl`. Runs BEFORE the dispatch-mode gate (same place as eyes + breadcrumb).
- **Modified**: dispatch core's status-comment creation switches from `createStatusComment` (POST-only) to `upsertStickyComment` (marker-based upsert). Action-mode-only installs find no existing sticky and create one. Dual-mode (App-installed + shim) installs find the bot's pre-posted sticky and edit it in place — single comment, two writers, idempotent.
- **No new App permissions**. Reuses `Issues: write` already granted.

## Capabilities

### Modified Capabilities

- `status-feedback`: sticky status comments are now created via marker-based upsert and may be posted pre-gate by the Probot adapter. The contract that "one sticky per actionable intent, mutated through the run" stays unchanged; what's new is who posts the first version.

## Impact

- New module: `src/handlers/shared/sticky-status.ts` (renderer + upsert wrapper) + tests.
- `src/dispatch.ts`: switches from `createStatusComment` to `upsertStickyComment`. Existing `updateStatusComment` calls in handlers are untouched (they edit by `commentId`, returned by the upsert just as they were by the create).
- `src/index.ts`: new `maybeAddStickyReceived` helper + new pre-gate call alongside `maybeAddEyes` / `maybeBreadcrumbImplStart`. New `stickyPreGateIntents` allowlist (4 intents).
- Existing dispatch tests updated to mock `upsertStickyComment` instead of `createStatusComment`.
- No change to label contract, intent classifier, reusable workflow, shim template, or OIDC broker.
