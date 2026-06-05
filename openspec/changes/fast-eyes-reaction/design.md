# Design: fast-eyes-reaction

## Context

`runDispatch` already calls `reactEyes` at the top — but in production `action` mode, Probot's issue/PR handlers no-op behind the `OPENSPEC_FLOW_DISPATCH_MODE` gate so `runDispatch` never fires from the App side. The shim workflow runs the same dispatch core in the user's runner, which means the reaction is added — just 30+ seconds after the label, once the runner has spun up.

App-installed repos pay for the App in part for fast UX. Make the 👀 sub-second when the App is present. Don't regress the always-on coverage the workflow already provides.

The change is structurally simple — one helper module, two adapters wiring it in — but worth a design note because (a) it crosses the gate the prior change just installed, (b) it introduces removal semantics that don't exist today, and (c) it touches both adapters.

## Goals / Non-Goals

**Goals:**

- Sub-second 👀 when the App is installed, regardless of `DISPATCH_MODE`.
- Eyes still added in Action-mode-only deployments (existing behaviour preserved).
- Eyes removed when work completes (success or failure) so a re-labelled issue gets a fresh ack.
- One shared helper used by both adapters — no second implementation.
- Idempotency on both ops: duplicate-add and missing-remove are no-ops.

**Non-Goals:**

- Progress emoji rotation (👀 → 🚀 → ✅). Out of scope; can layer on later.
- User-configurable reaction content. Hard-code "eyes".
- Reactions on comment / review events. Only label-driven `openspec:go`.
- Replacing the sticky status comment. Eyes are an extra signal, not a substitute.

## Decisions

### D1. Reaction helper lives in `src/reactions.ts`

**Decision**: New module exporting `addEyes(octokit, owner, repo, issueNumber, log)` and `removeEyes(octokit, owner, repo, issueNumber, log)`. Both best-effort: errors logged via `log.warn` and swallowed.

**Alternatives considered**:
- Inline the calls in each adapter. Rejected — drift risk, and removal needs `reactions.listForIssue` + filter, which is non-trivial to duplicate.
- Put the helper on `DispatchDeps`. Rejected — Probot's pre-gate path doesn't have a `DispatchDeps` yet (it runs before `runDispatch` is reached); module-level functions taking `octokit` directly are simpler.

**Why**: keeps both adapters thin, makes idempotency a single place to get right, and centralises any future "which reaction" decision.

### D2. Probot adds eyes **before** the dispatch-mode gate

**Decision**: In `src/index.ts`, after classifying the intent and before the `dispatchMode() !== "in-process"` no-op, call `addEyes` when the intent is `create-spec` / `iterate-spec` / `iterate-impl` (the ones the user actually triggers via the label). Visible / silent noops do not add eyes.

**Alternatives considered**:
- Add eyes on every `issues.labeled` regardless of label. Rejected — too eager; would 👀 unrelated labels.
- Add eyes inside `runDispatch` only. Rejected — that's the current state and the very thing the change exists to improve.

**Why**: gate-bypass is intentional and scoped to acknowledgement only. The gate's purpose (prevent the App from doing dispatch work the shim will also do) doesn't apply to a single idempotent reaction API call.

### D3. `runDispatch` keeps reaction add and adds reaction remove

**Decision**: `runDispatch` continues to call `addEyes` at the top (covers Action-mode-only repos) and calls `removeEyes` at the very end on both the success and failure exit paths (a `try/finally`-shaped wrapper around the existing body). `removeEyes` is best-effort.

**Alternatives considered**:
- Move the add to Probot only and rely on the workflow being App-installed. Rejected — Action-mode-only is a supported install path; removing the dispatch-core add would regress it.
- Skip removal entirely. Rejected — without removal the issue accumulates 👀 acks across iterate-go cycles, gradually making the ack meaningless.
- Remove only on the success path. Rejected — failed runs leave stale eyes; users see no signal that the run finished at all.

**Why**: covers both install modes without coupling, and the failure-path removal closes the lifecycle even on the unhappy path.

### D4. Probot removes eyes on `workflow_run.completed`

**Decision**: Probot subscribes to `workflow_run.completed`, filters to the `openspec-flow` workflow name, and calls `removeEyes` on the originating issue/PR.

**Alternatives considered**:
- Listen for `pull_request.opened` carrying `openspec:spec` / `openspec:impl`. Rejected — only covers the success path; failures leave eyes on.
- Probot doesn't remove; rely on `runDispatch`'s own removal. Rejected — when Probot adds the eyes pre-gate but is in `action` mode, the dispatch core that removes them lives in the runner; if the runner step that runs `runDispatch` fails before reaching the removal block, eyes leak. The `workflow_run.completed` event fires whether the run succeeded or failed, giving a guaranteed cleanup signal.

**Why**: `workflow_run` is already in the `EVENTS` list (no new subscription); fires on success and failure; resolves the leak window cleanly.

**Finding the target issue/PR from a `workflow_run` event**: the run's `head_branch` matches the `chore/<n>-<slug>` or `feat/<n>-<slug>` branch convention. Extract `<n>` from the head branch when present; if not (e.g. workflow triggered on a non-conventional branch), fall back to scanning the dispatch core's own ledger via the status comment metadata — but in practice the branch-name parse covers all bot-driven runs.

### D5. Idempotency contract

**Decision**:

- `addEyes`: `reactions.createForIssue` is idempotent for the same content per-user — GitHub returns 200 with the existing reaction on duplicates. Treat any non-2xx response as a warning, never a throw.
- `removeEyes`: `reactions.listForIssue` filtered to `content=eyes` + the App / token's user, then `reactions.deleteForIssue` for each match. 404 on the delete swallowed. Empty list = no-op.

**Why**: makes the dual-path safe — Probot pre-gate add, dispatch-core add (same user, same content) both succeed without "already exists" noise; removal converges regardless of which path added.

### D6. No new App permissions

**Decision**: ride on existing `Issues: write`. Reactions endpoints (`POST /repos/{o}/{r}/issues/{n}/reactions`, `GET /repos/{o}/{r}/issues/{n}/reactions`, `DELETE /repos/{o}/{r}/issues/{n}/reactions/{id}`) all fall under the Issues permission set.

**Why**: zero re-consent friction; existing installs keep working.

## Risks / Trade-offs

- **Risk**: `workflow_run.completed` for a non-openspec-flow workflow fires `removeEyes` against a parsed branch number that isn't actually an openspec-flow issue. → **Mitigation**: filter by `workflow_run.name === "openspec-flow"` (matches the shim's `name:` field) before doing anything; bail otherwise.
- **Risk**: Probot adds the eyes pre-gate but the App user (`<slug>[bot]`) and the workflow user (`github-actions[bot]` or `<slug>[bot]` when App-token mint is configured) differ. Listing-for-removal must filter by content + user. If the two adders are different users and the remover only removes its own, one stays. → **Mitigation**: `removeEyes` removes ALL eyes reactions on the issue authored by openspec-flow identities (bot + actions); over-cleaning is acceptable since the only eyes we ever add come from this code path.
- **Risk**: rate-limit on high-traffic repos — every `openspec:go` now triggers an extra create + later list+delete (3 API calls). → **Mitigation**: per-event cost is tiny vs. the dispatch work that already runs; reaction calls cost 1 point each on the REST budget; ignorable.
- **Trade-off**: dual add path means transiently two callers race to add the same reaction. GitHub treats the second as a duplicate and returns 200 — no race condition, but logs show two attempts. Acceptable noise.
- **Trade-off**: removing on workflow completion means the eyes disappear at the same moment the impl-PR-opened comment appears on the issue. Both signals fire at once; the comment is the durable record, the eyes were the fast ack.

## Migration Plan

1. **Land the helper module + tests.** No behaviour change yet.
2. **Wire dispatch core** to use the helper for add and add the removal at the end of `runDispatch`. Existing tests pass.
3. **Wire Probot adapter** for pre-gate add + `workflow_run.completed` remove. Smoke against a sandbox repo (verifies dual-path idempotency).
4. **Docs update** in the same commit.
5. **Rollback**: revert the change set. Existing `reactEyes` behaviour returns. No user-side state to clean up — orphan eyes age naturally as users iterate.

## Open Questions

- **Q1**: Should `removeEyes` log which path removed it? Probably useful for debugging the race but adds noise to the hot path. Defer.
- **Q2**: Do we want to also drop the eyes on a manually-applied `openspec:spec` / `openspec:impl` (user marks a PR as belonging to the flow without going through `openspec:go`)? Edge case; defer.
- **Q3**: For `iterate-spec` / `iterate-impl` (label re-applied to an existing PR), eyes go on and off per iteration. Is that the right signal, or should they only fire on the originating issue? Lean toward per-event — every iteration is a discrete trigger that benefits from the same ack semantics.
