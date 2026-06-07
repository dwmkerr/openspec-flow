# Tasks: bot-pregate-sticky-status

- [x] 1.1 `src/handlers/shared/sticky-status.ts` — `stickyMarker(kind, target)`, `upsertStickyComment(...)`. Auto-appends marker when caller forgets it.
- [x] 1.2 Tests cover create on first call, patch on subsequent, distinct markers per (intent, target).
- [x] 1.3 Probot adapter posts the sticky `received` body pre-gate via `maybeAddStickyReceived`. Allowlist matches eyes + adds `create-impl`.
- [x] 1.4 Dispatch core uses `upsertStickyComment` instead of `createStatusComment`.
- [x] 1.5 Existing `dispatch.test.ts` mocks updated: `createStatusComment` replaced by `upsertStickyComment`.
- [x] 1.6 `npm test` green (137 pass).
- [x] 1.7 `openspec validate bot-pregate-sticky-status` green.
- [ ] 1.8 Smoke (live): label an issue with `openspec:go` on a sandbox repo where the App is installed; sticky `received` body appears within ~1s on the issue. Workflow runs ~30s later and the sticky transitions through `reading context` / `implementing` / `✅ opened` with the run-link line appearing on the second mutation.
