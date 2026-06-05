# issue-breadcrumb-and-run-link

## Why

Three gaps surfaced in real-world testing on `dwmkerr/livedown`:

1. **Issue went silent after spec PR merged.** The sticky status comment for `create-impl` lives on the spec PR (the merge event's target), so the originating issue saw no signal between "spec merged" and "impl PR opened" — a 30+ second gap where the user can't tell the system is working.
2. **No way to jump from a comment to the workflow run.** Sticky comments carry state but no `[Watch](url)` link, so when something's slow or wrong, users have no breadcrumb from "the comment is stalled" to "here's the run that's stalled".
3. **Silent failures.** `runDispatch` caught handler errors and logged them but the CLI `dispatch` step exited 0 anyway — runner badges showed green when the agent had crashed mid-run.

There's also no single authoritative reference for which surface (label, comment, reaction, breadcrumb) gets written by which actor (bot vs workflow). We've been re-deriving it on each design conversation.

## What Changes

- **New**: `src/handlers/shared/run-link.ts` — `currentRunUrl()` reads `GITHUB_SERVER_URL` / `GITHUB_REPOSITORY` / `GITHUB_RUN_ID`; `renderRunLink()` formats a `> 🔎 Watch: [run #N](url)` suffix. Returns empty in non-Action contexts so Probot in-proc doesn't render broken links.
- **New**: every sticky status comment renderer in `src/handlers/shared/status-bodies.ts` is wrapped to suffix the run-link line. Idempotent: body is fully re-rendered each state transition.
- **New**: `src/handlers/shared/comment-upsert.ts` — marker-based `upsertCommentByMarker(octokit, owner, repo, issueNumber, marker, body)` primitive. Lets two writers (App pre-gate + workflow handler) share a comment without exchanging in-memory IDs.
- **New**: `src/handlers/shared/issue-breadcrumb.ts` — `upsertImplBreadcrumb()` on the originating issue for `create-impl`. Four states: `starting`, `implementing`, `opened`, `failed`. Marker: `<!-- openspec-flow:issue-breadcrumb intent=create-impl issue=N spec-pr=M -->`.
- **New**: Probot adapter posts the `starting` breadcrumb pre-gate on `create-impl` (sub-second feedback on the issue).
- **Modified**: `runDispatch` returns `DispatchResult = { ok: boolean; error?: Error }` instead of `Promise<void>`. CLI `dispatch` step propagates `ok=false` as non-zero exit so the workflow's badge matches reality.
- **Modified**: `src/handlers/create-impl` upserts the issue breadcrumb on `implementing`, `opened`, and `failed` state transitions. Idempotent with the App's pre-gate post.
- **Modified**: `runAppInit` PR body honestly lists the three Actions secrets (`ANTHROPIC_API_KEY`, `OPENSPEC_FLOW_APP_ID`, `OPENSPEC_FLOW_PRIVATE_KEY`) with `gh secret set` commands. Notes the org-level-secret option for org installs. Links forward to the OIDC broker RFC (#79) as the path that removes the App-secret distribution requirement.
- **New**: `docs/state-machine.md` — authoritative reference for surfaces × actors × idempotency. Treated as source of truth; code and other docs sync to it.

## Capabilities

### New Capabilities

- `status-feedback`: surfaces written through the lifecycle of an actionable intent — the sticky status comment, the watch-link line inside it, the per-issue early breadcrumb for `create-impl`, and the marker-upsert primitive that lets both Probot and workflow collaborate on the same comments without ID coordination. Covers the "what gets written, where, by whom" contract.

### Modified Capabilities

- `openspec-flow`: `runDispatch` returns a structured `DispatchResult` so the CLI dispatch step propagates handler failures as non-zero exit (today everything exits 0 even when the agent crashed).
- `app-install-init`: init PR body lists App-bot secrets (`OPENSPEC_FLOW_APP_ID`, `OPENSPEC_FLOW_PRIVATE_KEY`) alongside `ANTHROPIC_API_KEY`, with the org-secret hint and a forward link to the OIDC broker RFC.

## Impact

- `src/handlers/shared/run-link.ts` (new), `comment-upsert.ts` (new), `issue-breadcrumb.ts` (new) — plus tests.
- `src/handlers/shared/status-bodies.ts` — every body renderer now suffixes the run link.
- `src/dispatch.ts` — return type changed; failures + unimplemented intents both bubble as `ok=false`.
- `src/cli.ts` — dispatch step exits 1 on `ok=false`.
- `src/index.ts` — Probot adapter posts the create-impl issue breadcrumb pre-gate.
- `src/handlers/create-impl/index.ts` — breadcrumb upserts at three lifecycle points.
- `src/app-install/index.ts` — PR body expanded; tests updated.
- `docs/state-machine.md` (new).
- No change to the label contract, intent classifier, or shim template.
- No new App permissions or runtime dependencies.
