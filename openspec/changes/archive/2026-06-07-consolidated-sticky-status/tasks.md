# Tasks: consolidated-sticky-status

- [x] 1.1 Pure renderer `renderLifecycleSticky` with all states (preparing / creating / pr-open / pr-iterating / pr-merged / failed / completed).
- [x] 1.2 Embedded base64 state marker; `parseStateFromBody` round-trips it.
- [x] 1.3 `mutateLifecycleSticky` — read-modify-write keyed off the marker.
- [x] 1.4 `resolveIssueNumber(intent)` for the four lifecycle intents.
- [x] 1.5 Probot adapter pre-gate calls the new mutator for all four lifecycle intents.
- [x] 1.6 `create-spec` handler mutates to `spec: pr-open` on PR open (alongside legacy lifecycle writer).
- [x] 1.7 `create-impl` handler mutates to `implementation: pr-open` on PR open; `implementation: failed` + failure overlay on handler throw.
- [x] 1.8 `finalize-impl` handler mutates to `implementation: pr-merged` on impl PR merge.
- [x] 1.9 Renderer tests cover every state + state-marker round-trip (10 tests).
- [x] 1.10 Existing handler tests pass with the double-write.
- [x] 1.11 `scripts/preview-sticky.mjs` renders all 9 states to PNG via Playwright. Same renderer the runtime uses.
- [x] 1.12 `npm test` green (147 pass).
- [x] 1.13 `openspec validate consolidated-sticky-status` green.
- [ ] 1.14 Smoke (live): label an issue → expect "preparing" sticky within ~1s; runner finishes → "spec PR opened" + table row updates; merge spec PR → "preparing impl"; impl PR opens → "awaiting review"; merge impl PR → "Completed.".
- [ ] 1.15 Follow-up change: rebuild README "how it works" around the sticky previews; remove the legacy lifecycle-comment + issue-breadcrumb writers.
