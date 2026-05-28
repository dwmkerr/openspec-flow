## 1. Extract dispatch core

- [x] 1.1 Create `src/dispatch.ts` with `DispatchDeps` and `runDispatch(intent, deps)`
- [x] 1.2 Move eyes reaction, sticky status comment create, visible-noop terminal, token-via-getToken, registry dispatch, null-handler visible failure, error catch into the core
- [x] 1.3 Keep the silent-noop log shortcut in the adapters (not the core)

## 2. Probot adapter

- [x] 2.1 Rewrite `src/index.ts` dispatch path to build `DispatchDeps` from the webhook `Context` and call `runDispatch`
- [x] 2.2 `getToken` mints the installation token via `context.octokit.auth`
- [x] 2.3 Existing Probot/handler tests stay green (behaviour unchanged)

## 3. dispatch CLI command

- [x] 3.1 Add `dispatch` subcommand to `src/cli.ts`
- [x] 3.2 Read `$GITHUB_EVENT_NAME` + `$GITHUB_EVENT_PATH`; parse payload; `classify()`
- [x] 3.3 Build octokit from `GITHUB_TOKEN`; `getToken` resolves the same token (or App token from env)
- [x] 3.4 Fail clearly when event env vars are missing
- [x] 3.5 Fixture test: feed a real `issues.labeled` payload, assert same intent as Probot path

## 4. Reusable workflow rewrite

- [x] 4.1 Replace `.github/workflows/openspec-flow.yml` with the thin checkout-build-dispatch workflow
- [x] 4.2 Trigger on issues.labeled, pull_request.labeled, pull_request.closed, issue_comment.created, pull_request_review_comment.created
- [x] 4.3 Conditional `actions/create-github-app-token@v1` when `OPENSPEC_FLOW_APP_ID` non-empty; prefer its token, else `GITHUB_TOKEN`
- [x] 4.4 Resolve the checkout ref to the caller-pinned tag (parse `github.workflow_ref` or pinned input)
- [x] 4.5 `actions/setup-node` cache keyed on `package-lock.json`
- [x] 4.6 Set `permissions: contents/pull-requests/issues: write`

## 5. Retire composite-action system

- [x] 5.1 Delete all 8 `.github/actions/openspec-flow-*` directories
- [x] 5.2 Confirm no remaining reference to them (grep)
- [x] 5.3 Remove the stale comment in `src/index.ts` pointing at `.github/actions/openspec-flow-*`

## 6. Verification

- [x] 6.1 `npm run typecheck` + `npm test` green
- [x] 6.2 `openspec validate wire-action-dispatch` clean
- [x] 6.3 Lint/build clean; confirm `dist/cli.js dispatch` runs locally against a saved event fixture

## 7. Archive + retire specs

- [x] 7.1 `openspec archive wire-action-dispatch --yes` (applies ADDED/MODIFIED/REMOVED to canonical specs)
- [x] 7.2 Delete the now-empty retired spec dirs (`openspec-flow-composite-actions`, `pr-usage-table`, `preflight-agent-checks`, `postflight-agent-checks`) if archive leaves them empty

## 8. End-to-end test

- [ ] 8.1 In git-workforest: `openspec-flow init`, push setup PR, merge
- [ ] 8.2 Label an issue `openspec:go`; confirm the Action run dispatches `create-spec` and opens a spec PR
