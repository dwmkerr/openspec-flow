# Tasks: unified-sticky-everywhere

- [x] 1.1 Renderer signature `(state, opts, prNumber?)` with `RenderOptions = { issueNumber, audience, appInstalled }`.
- [x] 1.2 PR audience prepends `Tracked on issue → #N` blockquote header.
- [x] 1.3 App-not-installed appends discreet italic install hint above the footer.
- [x] 1.4 Per-surface lookup markers (`sticky issue=N` vs `sticky pr=N issue=N`).
- [x] 1.5 Active rows accept optional `step` for inline sub-state.
- [x] 1.6 `mutateLifecycleStickyEverywhere` mirrors writes to issue + every provided PR.
- [x] 1.7 Probot pre-gate writes pass `appInstalled: true`.
- [x] 1.8 create-spec / create-impl / finalize-impl handlers call multi-target mutator with the right PR list at each transition.
- [x] 1.9 Reusable workflow Dispatch step exports `OPENSPEC_FLOW_APP_INSTALLED` from the broker / legacy mint step outputs.
- [x] 1.10 Renderer tests cover step inline / PR audience / install hint / per-PR marker / state round-trip (147 total pass).
- [x] 1.11 Preview script fixtures cover the new variants (12 PNGs).
- [x] 1.12 `openspec validate unified-sticky-everywhere` green.
- [ ] 1.13 Smoke (live): label livedown issue #114 with `openspec:go`; verify one sticky per surface (issue + spec PR + impl PR as they appear); install-hint visible when broker token absent.
- [ ] 1.14 Follow-up change: rip out per-target `sticky-status.ts` + `status-bodies.ts`; replace handler `setStatus(...)` with `step` mutations on the lifecycle sticky.
