# Design: consolidated-sticky-status

## Context

We landed two overlapping issue surfaces. They serve the same purpose. One consolidated comment, owned by one renderer, mutated by many writers, is the right shape.

The mutator pattern (read-modify-write keyed off an embedded state marker) lets the Probot pre-gate, the workflow handlers, and any future actor collaborate without coordination. It's the same primitive `comment-upsert.ts` already provides for stateless markers; here we add a state payload alongside.

## Goals / Non-Goals

**Goals:**
- One comment per issue, mutated through every state.
- Every state has a single descriptive headline that answers "where am I + what do I do next".
- Workflow link sits inline in the table row that's active. Headline stays short.
- Verbs are stable: `preparing` / `creating` / `iterating` only.
- PR refs hyperlink in any markdown renderer.
- Preview script uses the same renderer the runtime uses — no second source of truth.

**Non-Goals:**
- Deleting the legacy `upsertLifecycleComment` / `upsertImplBreadcrumb` paths. Double-write for safety; remove in a follow-up.
- Replacing the per-PR sticky-status comment (on the spec / impl PR itself). That serves per-run progress on the PR thread.
- Mid-agent tool-call progress. Separate change.
- README rebuild. Separate change, will consume the previews.

## Decisions

### D1. State lives inside the comment, base64 JSON, hidden HTML

**Decision**: each render appends two HTML comments at the end:

```
<!-- openspec-flow:sticky issue=130 -->
<!-- openspec-flow:sticky-state <base64-json> -->
```

Lookup uses the first marker (substring-stable). The state marker is the read-modify-write payload; writers parse the JSON, mutate, re-encode.

**Why**: avoids a separate "state store" service; the comment IS the store. Cheap. Survives operator action (deleting the comment = next writer reconstructs from seed). Multiple writers collaborate via standard list-then-edit-or-create.

**Trade-off**: comment bodies grow by ~200 bytes for the encoded state. Invisible to humans.

### D2. Mutator signature is `(state) => state`

**Decision**: `mutateLifecycleSticky(octokit, owner, repo, issueNumber, seedState, mutator, log)`. The seed is used when no sticky exists yet (first write). The mutator receives the current state (parsed from the comment) and returns the next state.

**Alternatives considered**:
- Pass field-by-field setters. Rejected — too many overloads for small writers.
- Pass an "operations" list (`{ op: 'set', path: 'spec', value: ... }`). Rejected — over-engineered for our small fields.

### D3. Verbs are an enum: `preparing` / `creating` / `iterating`

**Decision**: row's `kind` field carries the verb. `preparing` is the pre-gate window where the bot has acked but the runner hasn't started; `creating` is the first-pass agent run; `iterating` is a re-run triggered by a fresh `openspec:go` on an existing PR.

`drafting` (which the renderer used briefly during design iteration) is removed in favour of `creating` for symmetry across phases.

### D4. Workflow link lives in the table row, not the headline

**Decision**: when a row is active (`creating` or `pr-iterating`) it renders as `creating in workflow #234` or `PR #137 - iterating in workflow #234`. The headline stays plain English with no link.

**Why**: pins the link to the thing it describes. Eliminates the floating "view run" affordance that previously sat above the table with no clear referent.

### D5. PR refs render as explicit markdown links

**Decision**: `[#137](https://github.com/<owner>/<repo>/pull/137)`. Both the table row and the headline use this format.

**Why**: GitHub's auto-linking would handle bare `#137` in production, but the preview renderer (and any third-party markdown renderer) needs explicit URLs to hyperlink. Sticking to explicit links keeps preview and production identical.

### D6. Footer is a single right-aligned `<sub>` with two links

**Decision**: `<div align="right"><sub><a href="…">openspec-flow</a> · <a href="…">docs</a></sub></div>`. Identical across every state.

**Why**: the call-to-action ("Merge it…", "Add the `openspec:go` label…") lives in the headline now, so the footer is just discreet attribution. Right-aligned + `<sub>` makes it tiny without hiding it.

### D7. Warning sigil only on failure headlines

**Decision**: `⚠️` prefix on the failed headline. No other emoji / sigil anywhere.

**Why**: failure is the one state where signal value justifies the visual weight.

### D8. Double-write during migration

**Decision**: the new `mutateLifecycleSticky` call sits alongside the old `upsertLifecycleComment` / `upsertImplBreadcrumb` calls in each handler. Both write. Once we've verified end-to-end on a few real flows, the old writers come out in a follow-up.

**Why**: rollback safety. If the new sticky has a rendering bug we don't yet know about, the legacy comment still tells the story.

## Risks / Trade-offs

- **Risk**: encoded state grows over time. Mitigation: state shape is small (two phase rows + optional failure overlay); maximum reasonable size is a few hundred bytes. No need for size budgeting.
- **Risk**: a writer with stale code mutates `state` in a way the renderer doesn't understand. Mitigation: renderer falls back to a generic headline for unknown combinations; never throws.
- **Trade-off**: double-write phase means two comments on the issue for new flows until the follow-up cleanup. Acceptable for one release cycle.
- **Trade-off**: Playwright dep adds ~100MB to devDeps. Only used by the preview script; not loaded by the runtime. Worth it for accurate visuals.

## Migration Plan

1. Land code (this change) with double-write.
2. Smoke against a sandbox repo: trigger create-spec → spec PR → merge → create-impl → impl PR → merge → completed. Verify the new sticky reads correctly at every state.
3. Follow-up change to remove the legacy `upsertLifecycleComment` + `upsertImplBreadcrumb` writers and the old test mocks.
4. Follow-up change to rebuild README around the preview screenshots.

**Rollback**: revert. Legacy writers continue to work because they were never removed.

## Open Questions

- **Q1**: should the per-PR sticky-status comment (on the spec / impl PR thread) also be replaced by a per-PR render of the lifecycle sticky? Probably not — the PR thread benefits from per-run progress (`reading context`, `agent finished, pushing branch`) which is at finer granularity than the issue lifecycle. Keep them separate. Revisit if testing surfaces redundancy.
- **Q2**: workflow_run.completed currently removes the 👀 reaction; should it also force the sticky into a terminal state if the handler crashed before mutating? Defer until the failure path surfaces a real gap.
