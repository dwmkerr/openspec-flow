# Design: issue-breadcrumb-and-run-link

## Context

The dispatch core's sticky status comment is the canonical "what's openspec-flow doing right now" surface. But the comment lives on `targetNumber` — which for `create-impl` is the spec PR (the merge event's target), not the originating issue. So the issue silently sits in "spec PR merged" state for 30+ seconds until the workflow opens the impl PR and the lifecycle breadcrumb advances.

Status comments also lack any pointer to the workflow run, which makes "the comment looks stuck" hard to diagnose. Adding a watch-link is one line of rendering; doing it consistently across all states + both modes (Action / in-proc) is the design question.

Finally, the dispatch step swallowed handler failures and exited 0 — runs went green even when the agent crashed. This had been latent until livedown #130 exposed it via a `git push` failure that produced a green workflow badge.

## Goals / Non-Goals

**Goals**:
- Issue thread shows activity within ~1 second of the spec PR merging.
- Every state-mutation of a sticky comment carries a workflow-run link when one is available.
- Handler failures bubble to a non-zero CLI exit so workflow badges match reality.
- Single authoritative reference (a doc) for "which surface is written by which actor".
- Marker-based primitive that lets App + workflow collaborate on the same comment without exchanging in-memory IDs.

**Non-Goals**:
- Replacing the sticky status comment with per-state separate comments.
- Adding a progress emoji rotation (👀 → 🚀 → ✅).
- Server-side execution of dispatch (separate conversation, see OIDC broker RFC).
- Removing the App-secret distribution requirement (tracked in #79).

## Decisions

### D1. Run-link is a body suffix, not a separate API write

**Decision**: `renderRunLink()` returns a markdown line; status body renderers append it. Body is fully re-rendered on every state transition, so the link is always in lockstep — no separate edit, no second API call.

**Alternatives**: emit the link as its own comment (rejected — adds noise); attach as a check-run output (rejected — hidden in the Checks UI rather than the issue/PR thread).

### D2. Run-link reads only env, returns null otherwise

**Decision**: `currentRunUrl()` is a pure env reader. No `process.env` writes, no required Action context. Returns null when `GITHUB_REPOSITORY` or `GITHUB_RUN_ID` is missing.

**Why**: same renderer runs in Probot in-proc, Action mode, CLI runs, and unit tests. The null path means each context gets the right thing without conditionals at every call site.

### D3. Issue breadcrumb is a separate comment from the sticky, with its own marker

**Decision**: For `create-impl`, post a new comment on the originating issue (not the spec PR). Marker: `<!-- openspec-flow:issue-breadcrumb intent=create-impl issue=N spec-pr=M -->`. Four states: `starting`, `implementing`, `opened`, `failed`.

**Alternatives**:
- Move the sticky to the issue. Rejected — sticky's lifecycle is bound to `targetNumber`; changing that breaks `iterate-spec` / `iterate-impl` which legitimately target PRs.
- Cross-post the sticky body to both target + issue. Rejected — doubles every API call for one user-visible win.

### D4. Marker-based upsert primitive

**Decision**: `upsertCommentByMarker(octokit, owner, repo, issueNumber, marker, body)` lists comments on the issue, finds the one whose body contains `marker`, then PATCH-es it or POST-s a new one. Marker auto-appended to the body when caller forgot it.

**Why**: App and workflow can't share an in-memory `commentId`. The marker substring is the shared lookup key. Same primitive serves the breadcrumb today and (potentially) other dual-write surfaces tomorrow.

**Trade-off**: each upsert is `1 list + 1 write` API calls (vs. `1 write` if caller held the ID). For one-per-intent breadcrumb writes, the cost is invisible.

### D5. App posts "starting" pre-gate; workflow upserts subsequent states

**Decision**: Probot adapter posts `state: "starting"` on the `pull_request.closed` merged + `openspec:spec` event (the same event that fires `create-impl`). Workflow's `create-impl` handler upserts `state: "implementing"` (with the change name + run link), then `state: "opened"` (with the impl PR number) or `state: "failed"` on terminal exit. Marker is shared, so all writes target the same comment.

**Why**: App pre-gate gives sub-second feedback (the gap user observed); workflow upsert adds the run link (which only the workflow knows) + progress + terminal state.

### D6. `runDispatch` returns `DispatchResult`, callers bubble exit code

**Decision**: Change `runDispatch` return type from `Promise<void>` to `Promise<DispatchResult>` where `DispatchResult = { ok: boolean; error?: Error }`. CLI `dispatch` step returns 1 on `ok=false`. Probot adapter ignores `ok` (long-lived process, no exit code semantics).

**Alternatives**:
- Rethrow from the existing catch. Rejected — breaks current "best-effort, never throws" contract that the Probot adapter relies on.
- Track a global mutable "failed" flag. Rejected — invisible side-channel.
- New `runDispatchStrict` that rethrows. Rejected — two near-identical entry points.

**Why this works**: return-value-based signalling makes the failure path explicit at the call site. Each adapter decides what to do (CLI: exit non-zero; Probot: log). One code path inside `runDispatch`, two interpretations outside.

### D7. The state-machine doc is the authoritative reference

**Decision**: `docs/state-machine.md` is treated as source of truth for "which surface is written by which actor with which idempotency story". CLAUDE.md continues to host the high-level UX summary; specs continue to host the formal requirement-level contract. The state-machine doc bridges them by mapping requirements to actual code-level surfaces.

**Why**: every design conversation in this branch (and the prior two) re-derived this mapping from scratch. Having one canonical reference saves cycles + catches drift.

## Risks / Trade-offs

- **Risk**: marker-based upsert lists up to 100 comments per call. On issues with >100 comments, the breadcrumb might not be found and a duplicate is posted. → **Mitigation**: openspec-flow comments land early in the thread; per-issue bot comment volume is low. Pagination can land if/when a real issue surfaces.
- **Risk**: `currentRunUrl()` consults `process.env` at call time, not module load. In tests, sneaky mutations to `process.env` between tests would leak. → **Mitigation**: tests pass env explicitly; production reads `process.env` once per render which is fine.
- **Risk**: changing `runDispatch` return type touches every caller. → **Mitigation**: only two callers (CLI, Probot adapter); both updated in this change; tests updated.
- **Trade-off**: silent-failure fix means workflow runs that previously showed green will now show red. Existing users tracking the badge may see "regressions". → **Mitigation**: the badge now reflects reality. Communicate via PR body.
- **Trade-off**: the issue breadcrumb adds one extra comment per create-impl invocation. For high-volume repos this could clutter the thread. The comment is upserted (not re-created) per intent, so the net impact is "+1 comment per impl run", which seems acceptable.

## Migration Plan

1. Land the helpers + new module structure behind no flag (purely additive; non-Action contexts render no link).
2. Wire the breadcrumb at the App pre-gate + workflow handler.
3. Flip `runDispatch` return type + CLI exit code path.
4. Update init-PR body (App-secret docs).
5. Drop `docs/state-machine.md` and link from `CLAUDE.md`.
6. Smoke against `dwmkerr/shellwright` (already App-installed) — label issue, merge spec PR, expect issue thread updated within ~1s + workflow-run link in subsequent edits.

**Rollback**: pure revert. No persisted state. Existing comments stay; future runs simply stop maintaining the breadcrumb.

## Open Questions

- **Q1**: Should `iterate-spec` / `iterate-impl` also get an issue breadcrumb? Today the sticky lives on the PR being iterated, so the issue sees no activity. Leaning yes for symmetry but defer to a follow-up change to keep this one scoped.
- **Q2**: The lifecycle-comment helper (`upsertLifecycleComment`) and the new issue-breadcrumb helper both upsert by marker on the same issue. Should they unify? Probably yes once iterate-* breadcrumbs land — defer until then.
- **Q3**: The CLI exit-code change may surprise users running `openspec-flow dispatch` locally for debug. Today a crashed handler exits 0; after this change, exits 1. Worth a release note.
