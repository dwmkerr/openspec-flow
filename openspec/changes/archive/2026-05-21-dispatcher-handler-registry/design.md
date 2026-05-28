## Context

Dispatcher today (`src/index.ts` around line 155):

```ts
if (intent.kind === "create-spec" || intent.kind === "create-impl" || intent.kind === "iterate-spec") {
  try {
    ...mint token, build ctx, branch by kind...
    if (intent.kind === "create-spec")     { await handleCreateSpec({...}); }
    else if (intent.kind === "create-impl"){ await handleCreateImpl({...}); }
    else                                    { await handleIterateSpec({...}); }
  } catch (err) { ... }
}
```

The `if` filters the dispatch surface, and the inner cascade re-discriminates. Both lists drift over time. `iterate-impl` is the first observed casualty: classified, eyes reaction posted, sticky status comment created — handler never called.

## Goals / Non-Goals

**Goals:**

- Make silently-dropped intents structurally impossible. Adding a new `Intent` kind in `intent.ts` must require an explicit decision (real handler, or `null` with a tracking ref) before `tsc` passes.
- Replace the "stuck status comment" failure mode with a visible terminal state.
- Ship the missing `iterate-impl` handler so the registry has all five intents either wired or explicitly `null` with reason.

**Non-Goals:**

- Reworking the classifier. `src/intent.ts` is already exhaustive at the discriminated-union level.
- Adding new intents (e.g. `archive-impl`, `respond`). Future work.
- Replacing Probot or the webhook event surface.
- Generalising the registry beyond the dispatcher (no plugin model, no external registry).

## Decisions

### Decision 1: Mapped-type Record over Map / array

Use:

```ts
type IntentKind = Intent["kind"];
type Handler<K extends IntentKind> = (
  intent: Extract<Intent, { kind: K }>,
  ctx: HandlerCtx,
) => Promise<unknown>;

export const HANDLERS: { [K in IntentKind]: Handler<K> | null } = {
  "create-spec":  (i, c) => handleCreateSpec({...}),
  "create-impl":  (i, c) => handleCreateImpl({...}),
  "iterate-spec": (i, c) => handleIterateSpec({...}),
  "iterate-impl": (i, c) => handleIterateImpl({...}),
  "noop":         null,
};
```

Mapped-type Record gives **compile-time exhaustiveness**: omit a kind and `tsc` errors. `null` is the explicit "classified, not implemented" sentinel. The `Extract<Intent, { kind: K }>` keeps per-handler intent typing precise.

Alternatives considered:

- `Map<IntentKind, Handler>` — runtime structure; no exhaustiveness check.
- `switch` with `never`-assignment fall-through — works for exhaustiveness but mixes routing with the dispatch body, which is what we're trying to flatten.
- Array of `{ kind, dispatch }` — same as Map; loses key-based type narrowing.

### Decision 2: Visible noop for `null` entries

When dispatcher looks up an intent kind and finds `null`, it MUST:

1. Update the sticky status comment to `❌ <kind> is classified but not implemented yet — manage manually.`
2. Log a structured warning with the intent kind and event ids.
3. Return without throwing.

This converts the previous failure mode (stuck "Starting…") into a terminal state the reviewer can read.

Alternative considered: skip creating the status comment in the first place for `null` entries. Rejected — the dispatcher currently creates the comment *before* it looks up the handler (the comment id is passed to handlers as a parameter). Inverting that order would require threading `null`-awareness back into the dispatcher's event-handling top, which is exactly the kind of tangle the registry is meant to remove. Patching the existing comment is one line; reordering creates a broader refactor.

### Decision 3: iterate-impl handler shape mirrors iterate-spec

`iterate-impl` does for impl PRs what `iterate-spec` does for spec PRs:

- Read the originating issue + the impl PR's body, top-level comments, inline review comments, and review submissions.
- Ignore comments authored by `openspec-flow[bot]` / `openspec-flow-dev[bot]`.
- Mutate code under `src/` (and tests, docs) to address feedback. NOT mutate `openspec/changes/<name>/` — that capability belongs to iterate-spec; impl PRs ship code, spec deltas are already merged.
- Commit on the impl branch with a message describing the iteration.
- Patch the sticky status comment at the same milestones as iterate-spec (reading context, agent finished, push complete, terminal state).

Differences from iterate-spec:

- Reads from PR review threads explicitly. `iterate-spec`'s prompt already does this — copy the relevant section, scope to impl artefacts.
- Validation step is `openspec validate` if a change is in flight; otherwise `npm run typecheck` + `npm test`. (Tracked open.)

### Decision 4: CLI shape

`src/cli.ts` learns:

```
openspec-flow handle iterate-impl --pr <impl-pr> --repo <owner/repo>
```

Same pattern as `iterate-spec`. The CLI path's lazy-import discipline (set up during shim-init) means the new handler module loads only when invoked.

### Decision 5: Backwards compatibility

No event-surface change. No label-contract change. No public CLI rename. PR-body metadata HTML comment shape unchanged.

## Risks / Trade-offs

- **[Risk] `as never` cast in dispatch.** The lookup returns `Handler<IntentKind> | null` widened across the union, so calling `handler(intent, ctx)` needs a cast (or a typed helper that re-Extracts). → Use a small `dispatch()` wrapper function that does the `Extract` once per call site. ~6 LOC, removes the cast.
- **[Risk] iterate-impl scope creep.** Reviewers may file inline comments asking for spec changes. → Handler instruction explicitly forbids touching `openspec/changes/` or `openspec/specs/`. If the reviewer needs a spec change, they unmerge and iterate the spec PR. Document this in the prompt.
- **[Trade-off] Two-step refactor: registry + handler in same PR.** The registry is meaningless without at least one new entry to motivate it, and shipping the registry without iterate-impl leaves the actual reported bug unfixed. Bundle. (CLAUDE.md "one change per impl PR" — this is one OpenSpec change with two capabilities, fine.)

## Migration Plan

- Ship registry + iterate-impl + visible-noop in one impl PR off `chore/54-dispatcher-handler-registry`.
- Smoke-test by re-adding `openspec:go` to PR #52 after its merge — should now iterate the impl, or surface a clean reason if the impl PR has no actionable feedback.
- Rollback = revert the impl commit. The classifier is unchanged; the registry simply restores the old if-chain on revert.

## Open Questions

1. **Iterate-impl validation step** — is `npm run typecheck && npm test` enough, or do we run lint too? Lean run-typecheck-and-test for now; bot doesn't fix lint errors well.
2. **Handler ordering at the comment-creation step** — current dispatcher creates the sticky comment before classification of "actionable vs visible noop." Registry's `null` path needs the comment id to be patchable. We rely on the existing comment-creation order; revisit if it bites.
3. **Should `noop` ever get a status comment?** Today: no — the dispatcher's existing visible-noop path posts a one-off comment without sticky id. Registry treats `noop` the same as a `null` handler (sentinel). For now keep `noop` as `null` in the registry and let the existing visible-noop branch in the dispatcher run as before.
