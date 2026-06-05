# fast-eyes-reaction

## Why

Today `runDispatch` already adds the 👀 reaction on every actionable / visible-noop intent — but in production `action` mode, Probot's issue/PR handlers no-op behind the `OPENSPEC_FLOW_DISPATCH_MODE` gate, so `runDispatch` (and therefore the reaction) is only reached when the shim workflow eventually runs. That's a 30+ second spin-up — long enough for users to think "did anything notice my label?" and re-trigger.

The App's value-prop is fast UX. Add an App-only pre-gate reaction step so labelling an issue with `openspec:go` yields a sub-second 👀 — without changing how the dispatch core works. The reaction is also removed when work completes so the issue/PR doesn't accumulate stale acks across iterations.

## What Changes

- **New**: Probot adapter calls `addEyes` on `issues.labeled` / `pull_request.labeled` for `openspec:go` **before** the `DISPATCH_MODE` gate. Runs in every mode (App-installed = fast feedback regardless of dispatch path).
- **New**: Probot adapter calls `removeEyes` on `workflow_run.completed` for the openspec-flow workflow. Idempotent — 404-on-missing swallowed.
- **New**: shared helper module `src/reactions.ts` exposing `addEyes` / `removeEyes` so Probot adapter and dispatch core call the same code.
- **Modified**: `runDispatch` keeps its existing `reactEyes` call (renamed to use the shared helper) and adds a corresponding `removeEyes` at handler end (success or failure path). Idempotent — the App-mode pre-gate path may have already added it; createReaction returns 200 on duplicate; deleteReaction returns 404 if missing.
- **Out of scope**: progress emoji rotation (👀 → 🚀 → ✅); user-configurable reactions; reactions on comment events.

## Capabilities

### New Capabilities

- `fast-eyes-reaction`: instant 👀 acknowledgement from the App on every `openspec:go` label event, paired with deferred 👀 removal on workflow completion. Together with the existing dispatch-core reaction this gives "always-on eyes + App accelerates them" semantics with no clash between paths.

### Modified Capabilities

- `openspec-flow`: clarifies that `addEyes` / `removeEyes` are exempt from the `OPENSPEC_FLOW_DISPATCH_MODE` gate — the gate is about dispatching work, not acknowledging it.

## Impact

- `src/reactions.ts` (new) — `addEyes(octokit, repo, number)`, `removeEyes(octokit, repo, number)`. Both best-effort and idempotent.
- `src/index.ts` — pre-gate `addEyes` on labelled events; new `workflow_run.completed` handler for `removeEyes`.
- `src/dispatch.ts` — replace inline `reactEyes` with the shared helper; add `removeEyes` at the end of `runDispatch` (in finally-equivalent) so workflow-only path also clears the eyes.
- Tests: unit test the shared helper's idempotency (no throw on 404 / duplicate); unit test Probot adapter calls `addEyes` regardless of `DISPATCH_MODE`; unit test `workflow_run.completed` triggers `removeEyes`.
- Docs: `CLAUDE.md` § Install modes adds a line on the App's fast-eyes role; `docs/developer-guide.md` notes the reaction lifecycle.
- No change to handlers, label contract, intent classifier, or the shim template.
