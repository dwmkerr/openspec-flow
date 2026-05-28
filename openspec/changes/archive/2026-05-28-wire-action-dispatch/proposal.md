## Why

openspec-flow has two execution modes that have silently diverged:

- **App mode** — Probot service (`src/index.ts`) classifies webhooks and dispatches to the current handlers (`create-spec`, `iterate-spec`, `iterate-impl`, `create-impl`) via the registry. This is the maintained path.
- **Action mode** — the reusable workflow `.github/workflows/openspec-flow.yml` plus 8 composite actions under `.github/actions/openspec-flow-*`. This is the **pre-Probot system**: old labels (`openspec:start`, `openspec:spec-ready`, `openspec:exploring`, …), old jobs (plan / implement / respond / cleanup). It does not run any current handler.

The shim that `openspec-flow init` writes calls the Action-mode reusable workflow. So today, a repo installed via the CLI runs the stale system, not the current one. Shim mode is effectively broken.

This change makes both modes share one brain: classify → registry dispatch. App mode and Action mode become thin adapters over the same core, so they can never diverge again.

## What Changes

- **Extract the dispatch core** out of `src/index.ts` into `src/dispatch.ts`. The core takes a plain octokit, repo coordinates, a token, and a logger — not a Probot `Context`. It owns: eyes reaction, sticky status comment creation, registry lookup, visible-noop handling, error logging.
- **Probot becomes a thin adapter** — `src/index.ts` builds the core's inputs from the webhook `Context` and calls it.
- **New `openspec-flow dispatch` CLI command** — reads `$GITHUB_EVENT_NAME` + `$GITHUB_EVENT_PATH`, runs `classify()`, builds an octokit from `GITHUB_TOKEN` (or an App token when App creds are present), and calls the same core. Second thin adapter.
- **Rewrite the reusable workflow** `.github/workflows/openspec-flow.yml` — thin: trigger on the current lifecycle events (`issues.labeled`, `pull_request.labeled`, `pull_request.closed`, `issue_comment.created`, `pull_request_review_comment.created`), checkout `dwmkerr/openspec-flow` at the workflow's own ref, `npm ci && npm run build`, then `node dist/cli.js dispatch`. A conditional `actions/create-github-app-token@v1` step mints an `openspec-flow[bot]` token when `OPENSPEC_FLOW_APP_ID`/`OPENSPEC_FLOW_PRIVATE_KEY` secrets exist; otherwise the job uses `GITHUB_TOKEN` (commits attributed to `github-actions[bot]`).
- **BREAKING — retire the old composite-action system**: delete all 8 `.github/actions/openspec-flow-*` composite actions (orphaned once the workflow is rewritten — they are referenced only by the stale workflow).

## Capabilities

### New Capabilities

- `action-dispatch`: the `openspec-flow dispatch` command contract (event sources, classification, octokit/token construction, exit behaviour) and the reusable-workflow contract (triggers, checkout-and-build, conditional App-token identity, env surface).

### Modified Capabilities

- `openspec-flow`: rewrite the workflow-mode spec. Replace the old plan/implement/respond/cleanup + `openspec:start` lifecycle requirements with the current model — classify webhook → registry dispatch, two adapters (Probot + Action) over one core, the `openspec:go`/`openspec:spec`/`openspec:impl` label contract.

### Removed Capabilities

These four capabilities describe the retired composite-action system in full — every requirement is obsolete. Rather than emptying them via REMOVED deltas (OpenSpec rejects a zero-requirement spec), their canonical spec directories are deleted wholesale in this change:

- `openspec-flow-composite-actions`: the eight composite actions are deleted.
- `preflight-agent-checks`: the preflight composite action is deleted.
- `postflight-agent-checks`: the postflight composite action is deleted.
- `pr-usage-table`: the usage-table injection (old `inject-usage-table` action) is deleted; no current handler injects a usage table.

## Impact

- **Affected code**:
  - new `src/dispatch.ts` (extracted core)
  - modified `src/index.ts` (Probot adapter over core)
  - modified `src/cli.ts` (`dispatch` subcommand)
  - rewritten `.github/workflows/openspec-flow.yml`
  - deleted `.github/actions/openspec-flow-*` (8 dirs)
- **Affected specs**: 1 new, 1 rewritten, 4 removed (see Capabilities).
- **Identity**: Action mode without App creds commits as `github-actions[bot]` (documented degradation). App creds upgrade to `openspec-flow[bot]`.
- **APIs / deps**: no new runtime deps. Workflow gains `actions/checkout`, `actions/setup-node`, `actions/create-github-app-token` (all standard).
- **Distribution**: no npm publish required — the workflow checks out and builds from source at its pinned ref, so the shim's `@ref` and the runtime code stay version-coherent. npm publish + fetch-from-release remain deferred (ideas.md).
