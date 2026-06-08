# unified-sticky-everywhere

## Why

The lifecycle sticky on the issue is the canonical "where am I + what to do next" surface. Every other comment we post around the same flow either duplicates it (per-target sticky on `create-spec`'s target = issue) or fragments it (per-PR sticky-status carrying agent step text that disagrees with the lifecycle table on the issue).

Locked design from a long discussion:

- One sticky **structure** everywhere — same renderer, same state shape, same mutator pattern.
- The issue carries the canonical sticky. PRs carry the same sticky body with a "Tracked on issue #N →" header.
- When the App isn't installed, the sticky shows a discreet "Install the App for real-time updates" hint so the absence is visible at the reader rather than buried in `Settings → Installations`.
- Active row states (`creating`, `pr-iterating`) carry an optional `step` field for the agent's sub-state (`gathering context`, `implementing the change`, `pushing`). Renders inline so a reader sees what's happening without clicking the workflow run.

## What Changes

- `renderLifecycleSticky` signature changes from `(issueNumber, state)` to `(state, RenderOptions, prNumber?)` where `RenderOptions = { issueNumber, audience: "issue" | "pr", appInstalled: boolean }`. PR variants prepend `> Tracked on issue [#N](...) →`. App-not-installed variants append a discreet italic install hint above the footer.
- `RowState.creating` and `RowState.pr-iterating` gain optional `step?: string`. Renderer interpolates inline: `creating - gathering context in workflow #234`.
- New `mutateLifecycleStickyEverywhere(octokit, owner, repo, { issueNumber, prNumbers }, seedState, mutator, options, log)` — single mutator that reads current state once, applies the mutator, then upserts the rendered body to the issue AND every provided PR. Different audiences and lookup markers per surface; identical state payload.
- Old single-target `mutateLifecycleSticky` kept as a one-line shim around the multi-target helper for callers that only know the issue.
- Reusable workflow exports `OPENSPEC_FLOW_APP_INSTALLED` env to the dispatch step, computed from whether the broker step or legacy App-secret step minted a token. Handlers read it at call time so the sticky's install-hint footer reflects reality.
- Probot pre-gate write passes `appInstalled: true` unconditionally — receipt of the webhook proves the App is installed on the repo.
- Workflow handlers (`create-spec`, `create-impl`, `finalize-impl`) call `mutateLifecycleStickyEverywhere` with the appropriate PR numbers known at each transition.

## Capabilities

### Modified Capabilities

- `status-feedback`: lifecycle sticky is now rendered onto multiple surfaces simultaneously, carries an inline agent sub-step, and surfaces App install status to the reader. The state shape gains an optional `step` field on active rows.

## Impact

- `src/handlers/shared/lifecycle-sticky.ts` — extended renderer + new multi-target mutator. ~200 LOC delta.
- `src/index.ts` — Probot pre-gate passes `appInstalled: true`.
- `src/handlers/create-spec/index.ts` — mirrors sticky to the new spec PR; reads `OPENSPEC_FLOW_APP_INSTALLED` from env.
- `src/handlers/create-impl/index.ts` — mirrors sticky to spec PR + new impl PR. Failure path also mirrors to both PRs when the impl PR exists.
- `src/handlers/finalize-impl/index.ts` — mirrors terminal state to both PRs.
- `.github/workflows/openspec-flow.yml` — Dispatch step env adds `OPENSPEC_FLOW_APP_INSTALLED` derived from token-mint step outputs.
- `scripts/preview-sticky.mjs` — fixtures cover PR variant, App-not-installed variant, and inline step variant. Same renderer drives them all.
- Tests: 4 new for the new variants (PR header, install hint, step interpolation, per-PR marker). 147 total pass.

## Out of Scope (Follow-up)

- Replacing handler `setStatus(statusReadingIssue/...)` calls with `step` mutations on the lifecycle sticky. Today's per-target sticky-status comments stay alongside — duplicated detail until the follow-up sweep deletes `sticky-status.ts` and `status-bodies.ts`.
- A CLI verb `openspec-flow comment update --issue <n> --phase <p> --step "<s>"` so the agent can self-report sub-state during long runs.
