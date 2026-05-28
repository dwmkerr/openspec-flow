## Context

`src/index.ts` today contains the dispatcher inline, coupled to Probot's `Context`:

```ts
const dispatch = async (intent, context) => {
  // silent-noop log shortcut
  // eyes reaction (context.octokit.reactions...)
  // create sticky status comment (context.octokit...)
  // visible-noop → comment is terminal, return
  // mint installation token (context.octokit.auth)
  // dispatchTo(intent, { octokit: context.octokit, ... })
  // null-handler → patch status comment, warn
};
```

Everything substantive uses only `context.octokit`, `context.repo()`, and `context.log`. Nothing needs the full Probot `Context`. So the core is extractable behind a small interface, and both Probot and a CLI command can drive it.

The Action-mode runtime (`.github/workflows/openspec-flow.yml` + composite actions) is the pre-Probot system and is being retired wholesale, not migrated.

## Goals / Non-Goals

**Goals:**
- One routing brain. App + Action are thin adapters over `src/dispatch.ts`.
- Action mode runs the current handlers end-to-end, triggered by `openspec:go` (and the merge/comment events the classifier already understands).
- Version coherence: the shim pins `@ref`; the reusable workflow at that ref builds and runs that exact code.
- Conditional identity: `openspec-flow[bot]` when App creds present, `github-actions[bot]` otherwise — no hard dependency on the App for the bot to function.

**Non-Goals:**
- App install handler / auto setup PR (#46).
- App credential distribution (how creds reach the repo) — separate RFC.
- npm publish / fetch-from-release.
- Preserving any behaviour of the old composite-action system.

## Decisions

### Decision 1: Dispatch core interface

`src/dispatch.ts` exports:

```ts
export interface DispatchDeps {
  octokit: MinimalOctokit;
  owner: string;
  repo: string;
  log: RunAgentLogger;
  // Mint a fresh push/clone token. Probot supplies an installation
  // token; the CLI supplies GITHUB_TOKEN or an App token.
  getToken: () => Promise<string>;
  // React + comment helpers already exist; core calls them.
}

export const runDispatch = (intent: Intent, deps: DispatchDeps) => Promise<void>;
```

`runDispatch` owns the full sequence currently in `src/index.ts`: silent-noop shortcut is handled *before* calling (it's a logging concern), eyes reaction, sticky status comment, visible-noop terminal, token mint via `getToken()`, registry dispatch, null-handler visible failure, error catch.

Rationale: `getToken` as a callback decouples token *source* (installation vs `GITHUB_TOKEN` vs App-token-from-PEM) from the dispatch logic. Each adapter supplies its own.

Alternatives considered:
- Pass the token directly instead of a callback — rejected; Probot mints lazily only for actionable intents, and we want to preserve that (don't mint for visible noops).
- Keep dispatch in `index.ts`, duplicate it in the CLI — rejected; that's the divergence we're removing.

### Decision 2: `openspec-flow dispatch` reads the GitHub event file

In Actions, the webhook payload is at `$GITHUB_EVENT_PATH` (a JSON file) and the event name is `$GITHUB_EVENT_NAME`. The command:

```ts
const eventName = process.env.GITHUB_EVENT_NAME;
const payload = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const intent = classify(eventName, payload);
// repo from payload.repository.{owner.login,name}
// octokit from GITHUB_TOKEN (or App token)
await runDispatch(intent, deps);
```

`classify(eventName, payload)` is the exact function Probot calls. Same inputs (event name + raw payload), same output. No reimplementation.

Rationale: `$GITHUB_EVENT_PATH` is the canonical Actions event source; matches what `classify` already expects.

### Decision 3: Reusable workflow checks out and builds at its own ref

```yaml
name: openspec-flow
on:
  issues: { types: [labeled] }
  pull_request: { types: [labeled, closed] }
  issue_comment: { types: [created] }
  pull_request_review_comment: { types: [created] }
jobs:
  flow:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - name: Mint App token (optional)
        id: app-token
        if: ${{ env.OPENSPEC_FLOW_APP_ID != '' }}
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ secrets.OPENSPEC_FLOW_APP_ID }}
          private-key: ${{ secrets.OPENSPEC_FLOW_PRIVATE_KEY }}
      - uses: actions/checkout@v4
        with:
          repository: dwmkerr/openspec-flow
          ref: ${{ github.workflow_ref ... pinned tag }}
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && npm run build
      - run: node dist/cli.js dispatch
        env:
          GITHUB_EVENT_NAME: ${{ github.event_name }}
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token || secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

The checkout `ref` resolves to the same tag the caller pinned in the shim, keeping shim and runtime code in lockstep. `GITHUB_EVENT_PATH` is set automatically by Actions; we pass `GITHUB_EVENT_NAME` explicitly.

Rationale: checkout-and-build needs no npm publish, and pinning the checkout to the shim's ref gives free version coherence. ~40s cold build per run is acceptable for an async bot.

Alternatives considered:
- `npx @dwmkerr/openspec-flow dispatch` — needs npm publish + the version float problem; deferred.
- Ship a prebuilt `dist/` in the repo — rejected; build artefacts in git are an anti-pattern and drift from source.

### Decision 4: Conditional identity

The App-token step runs only when `OPENSPEC_FLOW_APP_ID` is non-empty. Its output token (if minted) is preferred over `GITHUB_TOKEN` in the `dispatch` step's env. So:

- App creds present → `openspec-flow[bot]`, can edit workflow files, downstream-workflow-triggering PRs.
- Absent → `GITHUB_TOKEN` → `github-actions[bot]`, cannot trigger downstream workflows (irrelevant — our triggers are user labels), can edit workflow files only if `permissions: ` grants it (it does not by default for workflow files; acceptable — the bot doesn't edit `.github/workflows/`).

Rationale: the shim already passes both secrets via `|| ''`, so the mechanism activates the moment creds exist. No code change needed when the App lands.

### Decision 5: Retire the old composite-action system wholesale

Delete all 8 `.github/actions/openspec-flow-*` and the 4 stale specs. They are referenced only by the old workflow (verified). The new dispatch path uses none of them — handlers call `src/agent/run.ts` directly, status comments come from `src/handlers/shared/status-comment.ts`, etc.

The `openspec-flow` capability spec is rewritten (MODIFIED) rather than removed: the capability name still names "the workflow-mode product", but its requirements now describe the classify→dispatch model and the two adapters.

### Decision 6: Silent-noop stays out of the core

The "silent noop → single log line, return" shortcut is a *logging* concern specific to how each adapter wants to report. Probot logs via `context.log`; the CLI logs to stdout. Keep that shortcut in each adapter, before calling `runDispatch`. The core only ever sees actionable or visible-noop intents.

## Risks / Trade-offs

- **[Risk] `classify` may rely on payload shape differences between Probot and raw Actions event.** → They are the same GitHub webhook payload. Probot passes `context.payload`; Actions writes the identical payload to `$GITHUB_EVENT_PATH`. Verify with a fixture test feeding a real `issues.labeled` payload to both paths.
- **[Risk] `getToken` callback changes when the dispatcher mints lazily.** → Core calls `getToken()` only on the actionable-handler branch, after the visible-noop early return, preserving today's "don't mint for noops" behaviour.
- **[Risk] Reusable workflow `ref` resolution.** → `github.workflow_ref` gives the called workflow's ref; pin the checkout to the tag the shim used. For `@main` testing, checkout `main`. Document the exact expression.
- **[Trade-off] ~40s build per Action run.** → Acceptable for an async PR bot. npm-publish path (faster) is the documented future optimisation.
- **[Trade-off] `github-actions[bot]` identity for CLI-only installs.** → Documented. Bot fully functional; only the author label and downstream-trigger differ. App install upgrades it.

## Migration Plan

1. Land `src/dispatch.ts` + Probot adapter refactor; existing Probot tests stay green (behaviour unchanged).
2. Add `openspec-flow dispatch` CLI command + a fixture test.
3. Rewrite the reusable workflow; delete composite actions.
4. Archive the change (removes the 4 stale specs, rewrites `openspec-flow`, adds `action-dispatch`).
5. Test on git-workforest: `openspec-flow init` → push setup PR → merge → label an issue `openspec:go` → confirm the Action run dispatches `create-spec`.

Rollback: revert the change. The shim in any target repo keeps pointing at `@ref`; reverting restores the prior workflow at that ref.

## Open Questions

1. **Exact checkout-ref expression.** `github.workflow_ref` includes the full `owner/repo/.github/workflows/file@ref`; need to parse the trailing `@ref`, or use a simpler pinned input. Resolve during impl.
2. **Does `pull_request.closed` (merge → create-impl) need `GITHUB_TOKEN` with extra scope?** create-impl opens a PR; default `pull-requests: write` covers it. Confirm in test.
3. **Build caching.** `actions/setup-node` cache keyed on `package-lock.json` cuts the ~40s. Add now or defer? Lean add (cheap).
