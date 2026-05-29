## 1. Lifecycle comment helper

- [x] 1.1 `src/handlers/shared/lifecycle-comment.ts` — `renderLifecycle({ specPr, implPr, phase })` + `upsertLifecycleComment(octokit, owner, repo, issueNumber, body, log)`
- [x] 1.2 Marker `<!-- openspec-flow:lifecycle -->`; find bot comment carrying it → edit, else create; best-effort (warn on failure)

## 2. Classifier

- [x] 2.1 Add `finalize-impl` intent `{ prNumber }` to `src/intent.ts` + `describe`
- [x] 2.2 impl-PR-merge case returns `finalize-impl` (was silent noop)

## 3. Registry + handler

- [x] 3.1 `src/handlers/finalize-impl/index.ts` — resolve issue from impl-PR metadata, upsert terminal lifecycle line; no clone/agent/PR
- [x] 3.2 Register `finalize-impl` in `src/handlers/registry.ts`

## 4. Stamp points

- [x] 4.1 `create-spec`: upsert lifecycle at `spec-opened` after opening the spec PR
- [x] 4.2 `create-impl`: upsert lifecycle at `impl-opened` on the originating issue (from spec-PR metadata) after opening the impl PR

## 5. Docs

- [x] 5.1 Update root `CLAUDE.md` trigger table: impl-merge → `finalize-impl`

## 6. Verification

- [x] 6.1 Unit tests: render ticks per phase; upsert create vs edit; finalize on closed issue
- [x] 6.2 `npm run typecheck` + `npm test` green
- [x] 6.3 `openspec validate issue-lifecycle-comment` clean

## 7. Archive

- [x] 7.1 `openspec archive issue-lifecycle-comment --yes`
