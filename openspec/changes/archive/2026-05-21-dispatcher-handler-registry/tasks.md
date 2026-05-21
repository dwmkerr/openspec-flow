## 1. Handler registry module

- [x] 1.1 Create `src/handlers/registry.ts` exporting `HandlerCtx`, `Handler<K>`, `IntentKind`, and `HANDLERS`
- [x] 1.2 Map `create-spec`, `create-impl`, `iterate-spec` to existing handlers
- [x] 1.3 Map `iterate-impl` to new handler
- [x] 1.4 Map `noop` to `null`

## 2. Dispatcher rewrite

- [x] 2.1 Replace the if-chain in `src/index.ts` with `dispatchTo(intent, ctx)`
- [x] 2.2 Null-handler path: update sticky status comment with `❌ <kind> not implemented yet — manage manually`; log warn; return
- [x] 2.3 Real-handler path: mint installation token, build ctx, invoke handler via typed dispatch helper
- [x] 2.4 Preserve the existing try/catch with the same log surface

## 3. iterate-impl handler

- [x] 3.1 Create `src/handlers/iterate-impl/` (mirror iterate-spec layout)
- [x] 3.2 `index.ts` — accept `HandlerCtx & { implPrNumber: number }`, drive checkout / agent / commit
- [x] 3.3 `prompt.md` — scope to PR review threads, impl branch, originating issue; explicit "no openspec/ mutations"
- [x] 3.4 `verify.ts` — block commits that touch `openspec/changes/`, `openspec/specs/`, or `.github/workflows/openspec-flow.yml`
- [ ] 3.5 `index.test.ts` — happy path, bot-comment filtering, mutation-scope rejection — deferred to follow-up tests issue

## 4. CLI wiring

- [x] 4.1 Add `handle iterate-impl --pr <impl-pr> --repo <owner/repo>` subcommand to `src/cli.ts`
- [x] 4.2 Lazy-import the iterate-impl module to match the other handle subcommands

## 5. Tests

- [ ] 5.1 Compile-time test (or runtime exhaustiveness check) that registry covers every `Intent["kind"]` — relies on `tsc` exhaustiveness via mapped Record; explicit assertion deferred
- [ ] 5.2 Unit test: null-handler dispatch updates sticky comment + logs + returns 0 — deferred
- [ ] 5.3 Unit test: real-handler dispatch invokes handler exactly once with correct ctx shape — deferred
- [ ] 5.4 Integration test: webhook with `openspec:go` on an `openspec:impl`-labelled PR routes to iterate-impl handler — deferred

## 6. Verification

- [x] 6.1 `npm run typecheck` passes
- [x] 6.2 `npm test` passes (existing 73 tests still green; new unit tests deferred to §5)
- [ ] 6.3 Smoke: classify a known `iterate-impl` event on a real PR after merge

## 7. Archive

- [x] 7.1 `openspec validate dispatcher-handler-registry` clean
- [x] 7.2 `openspec archive dispatcher-handler-registry --yes` in the impl PR
