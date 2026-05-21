## 1. Handler registry module

- [ ] 1.1 Create `src/handlers/registry.ts` exporting `HandlerCtx`, `Handler<K>`, `IntentKind`, and `HANDLERS`
- [ ] 1.2 Map `create-spec`, `create-impl`, `iterate-spec` to existing handlers
- [ ] 1.3 Map `iterate-impl` to new handler (after task §3)
- [ ] 1.4 Map `noop` to `null`

## 2. Dispatcher rewrite

- [ ] 2.1 Replace the if-chain in `src/index.ts` with `const handler = HANDLERS[intent.kind]`
- [ ] 2.2 Null-handler path: update sticky status comment with `❌ <kind> not implemented yet — manage manually`; log warn; return
- [ ] 2.3 Real-handler path: mint installation token, build ctx, invoke `handler(intent as never, ctx)` (or via typed dispatch helper)
- [ ] 2.4 Preserve the existing try/catch with the same log surface

## 3. iterate-impl handler

- [ ] 3.1 Create `src/handlers/iterate-impl/` (mirror iterate-spec layout)
- [ ] 3.2 `index.ts` — accept `HandlerCtx & { implPrNumber: number }`, drive checkout / agent / commit
- [ ] 3.3 `prompt.md` — scope to PR review threads, impl branch, originating issue; explicit "no openspec/ mutations"
- [ ] 3.4 `verify.ts` — block commits that touch `openspec/changes/` or `openspec/specs/` or `.github/workflows/openspec-flow.yml`
- [ ] 3.5 `index.test.ts` — happy path, bot-comment filtering, mutation-scope rejection

## 4. CLI wiring

- [ ] 4.1 Add `handle iterate-impl --pr <impl-pr> --repo <owner/repo>` subcommand to `src/cli.ts`
- [ ] 4.2 Lazy-import the iterate-impl module to match the other handle subcommands

## 5. Tests

- [ ] 5.1 Compile-time test (or runtime exhaustiveness check) that registry covers every `Intent["kind"]`
- [ ] 5.2 Unit test: null-handler dispatch updates sticky comment + logs + returns 0
- [ ] 5.3 Unit test: real-handler dispatch invokes handler exactly once with correct ctx shape
- [ ] 5.4 Integration test: webhook with `openspec:go` on an `openspec:impl`-labelled PR routes to iterate-impl handler

## 6. Verification

- [ ] 6.1 `npm run typecheck` passes
- [ ] 6.2 `npm test` passes
- [ ] 6.3 Smoke: classify a known `iterate-impl` event, confirm sticky comment terminates correctly

## 7. Archive

- [ ] 7.1 `openspec validate dispatcher-handler-registry` clean
- [ ] 7.2 `openspec archive dispatcher-handler-registry --yes` in the impl PR
