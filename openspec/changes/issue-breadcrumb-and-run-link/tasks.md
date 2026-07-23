# Tasks: issue-breadcrumb-and-run-link

## 1. Run-link helper

- [x] 1.1 `src/handlers/shared/run-link.ts` — `currentRunUrl(env)`, `renderRunLink(env)`.
- [x] 1.2 Unit tests cover Action context, non-Action context, and SERVER_URL default.
- [x] 1.3 `src/handlers/shared/status-bodies.ts` — wrap every renderer with `withRunLink()` so body re-renders carry the link in lockstep.

## 2. Marker-based comment upsert

- [x] 2.1 `src/handlers/shared/comment-upsert.ts` — `upsertCommentByMarker()` list-find-edit-or-create.
- [x] 2.2 Auto-append marker when caller forgot it.
- [x] 2.3 Unit tests: creates on first call, patches on subsequent, returns null on list failure.

## 3. Issue early breadcrumb (create-impl)

- [x] 3.1 `src/handlers/shared/issue-breadcrumb.ts` — `renderImplBreadcrumb(state, specPrNumber)` for the four states; `upsertImplBreadcrumb()` upserts via the shared marker.
- [x] 3.2 Probot adapter posts `state: "starting"` pre-gate on `create-impl` events (in `src/index.ts`).
- [x] 3.3 `create-impl` handler upserts `state: "implementing"` after resolving the change context.
- [x] 3.4 `create-impl` handler upserts `state: "opened"` on impl PR creation.
- [x] 3.5 `create-impl` handler upserts `state: "failed"` on terminal handler failure.

## 4. Silent-failure fix

- [x] 4.1 `runDispatch` returns `Promise<DispatchResult>` where `DispatchResult = { ok, error? }`.
- [x] 4.2 Handler-throw branch returns `{ ok: false, error }`.
- [x] 4.3 Unimplemented-intent branch returns `{ ok: false }`.
- [x] 4.4 Happy path + visible noop return `{ ok: true }`.
- [x] 4.5 CLI `dispatch` step exits 1 on `ok: false` and logs the reason.
- [x] 4.6 Existing dispatch tests updated; new `runDispatch returns ok=false on handler throw` test passes.

## 5. Init-PR body honesty (App secrets)

- [x] 5.1 `runAppInit` PR body lists one Claude credential (`CLAUDE_CODE_OAUTH_TOKEN` recommended, `ANTHROPIC_API_KEY` supported) plus the two App-identity secrets with `gh secret set` commands.
- [x] 5.2 Body notes the org-secret option for `OPENSPEC_FLOW_PRIVATE_KEY`.
- [x] 5.3 Body explains the `GITHUB_TOKEN` fallback constraint (no `.github/workflows/*` writes).
- [x] 5.4 Body links forward to the OIDC broker RFC (#79).
- [x] 5.5 Existing app-install tests updated to assert the new secret strings.

## 6. State-machine doc

- [x] 6.1 `docs/state-machine.md` — lifecycle ASCII + surfaces × actors × idempotency tables.
- [x] 6.2 Reaction lifecycle diagram included.

## 7. Validation + smoke

- [x] 7.1 `npm run build && npm test` green locally.
- [x] 7.2 `openspec validate issue-breadcrumb-and-run-link` green.
- [ ] 7.3 Manual smoke: label an issue with `openspec:go` on a sandbox repo with App installed; sticky comment carries `Watch:` link.
- [ ] 7.4 Manual smoke: merge a spec PR; originating issue receives `impl run starting…` within ~1s.
- [ ] 7.5 Manual smoke: workflow run reaches `implementing` state; breadcrumb upserts with run link.
- [ ] 7.6 Manual smoke: impl PR opens; breadcrumb becomes `✅ impl PR opened: #M`.
- [ ] 7.7 Manual smoke: induce handler failure; CLI dispatch exits non-zero and runner badge shows red.
