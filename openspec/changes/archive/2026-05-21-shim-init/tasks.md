## 1. CLI plumbing

- [x] 1.1 Add `init` subcommand to existing `src/cli.ts` argv parser (zero new deps)
- [x] 1.2 Lazy-import handler modules so `init` runs without loading handler prompt files
- [x] 1.3 Wire `--yes`, `--force`, `--path` flags

## 2. Module layout

- [x] 2.1 Create `src/init/templates.ts` — workflow YAML + README block + markers
- [x] 2.2 Create `src/init/detect.ts` — `openspec/`, `openspec` CLI, `openspec-*` skills, `gh secret list` probe
- [x] 2.3 Create `src/init/plan.ts` — pure planner over `FsState` and `PlanOptions`
- [x] 2.4 Create `src/init/apply.ts` — filesystem reader + writer
- [x] 2.5 Create `src/init/index.ts` — orchestrator: detect → secrets → plan → apply → next-steps

## 3. Behaviour

- [x] 3.1 Hard gate: exit 1 with instruction when `openspec/` is absent
- [x] 3.2 Write `.github/workflows/openspec-flow.yml` from template (`@main` ref while package is 0.0.0)
- [x] 3.3 Patch / append README managed block between markers; preserve content outside markers
- [x] 3.4 Idempotent re-run (byte-equality on workflow; markers-present → leave alone on README)
- [x] 3.5 `--force` overwrites hand-edited workflow + overwrites between README markers
- [x] 3.6 Non-TTY without `--yes` exits 2 with explanation
- [x] 3.7 Always probe `ANTHROPIC_API_KEY` via `gh secret list`; report present/missing/skipped; no opt-out flag
- [x] 3.8 Marker names use space form (`<!-- openspec-flow init-start -->` / `init-end`)

## 4. Next steps output

- [x] 4.1 Render `Next steps` block with verbatim `chore: openspec-flow setup` PR title
- [x] 4.2 Suppress on full no-op runs

## 5. Verification

- [x] 5.1 `npm run build` clean
- [x] 5.2 Smoke test: missing `openspec/` → exit 1, no files written
- [x] 5.3 Smoke test: present `openspec/` → workflow + README written, exit 0
- [x] 5.4 Smoke test: re-run is no-op (markers-present → README untouched)
- [x] 5.5 Smoke test: `gh secret list` probe runs on a real GitHub remote

## 6. Deferred (tracked separately)

- [ ] 6.1 Unit tests for `plan.ts` across all states — follow-up tests issue
- [ ] 6.2 Integration test under `tests/integration/init.test.ts` — same
- [ ] 6.3 Hash-based version-aware idempotency — `--force` handles divergence today; revisit if shim template churns
- [ ] 6.4 Docs sync (`README.md`, `docs/architecture.md`, `public/index.html`, root `CLAUDE.md`) — lands in follow-up
- [ ] 6.5 `.openspec-flow.yaml` write — deferred until first real runtime override (#49 closed as not-planned)
- [ ] 6.6 Auto-PR open via App token — #46
- [ ] 6.7 IDE detection + skill install — #47 (defers to OpenSpec CLI's tool selection)
- [ ] 6.8 OpenSpec auto-invoke when missing — #48 (hard gate today; user runs OpenSpec themselves)
- [ ] 6.9 Animated welcome screen — #50
- [ ] 6.10 `act` local-runner recipe — #51
- [ ] 6.11 Dispatcher handler registry + iterate-impl — sibling change `dispatcher-handler-registry`

## 7. Archive

- [x] 7.1 Run `openspec validate shim-init` and confirm clean
- [x] 7.2 Archive change with `openspec archive shim-init --yes` in this PR
