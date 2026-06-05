# Tasks: app-init-force-upgrade

- [x] 1.1 `AppInitOpts.force?: boolean` added.
- [x] 1.2 Planner invoked with `{ force }` so managed regions are overwritten when set.
- [x] 1.3 `allNoop → already-initialised` and `hasOpenInitPR → pr-already-open` short-circuits guarded by `!force`.
- [x] 1.4 PR title becomes `chore: openspec-flow upgrade` when `force`; body intro explains upgrade scenario.
- [x] 1.5 `pulls.create` 422 recovered by `pulls.list({ head, state: "open" })`; returns existing PR URL.
- [x] 1.6 CLI `app-init --force` flag wired through to `runAppInit`.
- [x] 1.7 Tests: force bypasses already-initialised (asserts upgrade title + write); force recovers from 422 (asserts existing PR URL).
- [x] 1.8 `npm test` green (120 tests).
- [x] 1.9 `openspec validate app-init-force-upgrade` green.
- [ ] 1.10 Smoke (live): `npm run cli -- app-init --repo dwmkerr/livedown --as-app --force` opens an upgrade PR; merging it lets the workflow run with the new template.
