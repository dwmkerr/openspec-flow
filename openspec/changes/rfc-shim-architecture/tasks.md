## 1. Land the contract

- [ ] 1.1 Confirm the `shim-distribution` capability name does not collide with an existing spec under `openspec/specs/`
- [ ] 1.2 Cross-check the App permission set in `specs/shim-distribution/spec.md` against `docs/app-setup.md` and reconcile any drift in this PR
- [ ] 1.3 Validate the change with `openspec validate rfc-shim-architecture`

## 2. Sync dependent docs

- [ ] 2.1 Update `docs/architecture.md` — replace the "Mode A / Mode B" framing with the shim-first model, keeping Probot as install/drift handler only
- [ ] 2.2 Update `docs/app-setup.md` — explain that the install PR now writes the shim, and that the user merges to opt in
- [ ] 2.3 Update `README.md` — short "install the App, merge the PR it opens" install summary
- [ ] 2.4 Update `public/index.html` — adjust the mental model diagram so the App's box says "manages shim + identity", not "runs the agent"
- [ ] 2.5 Update root `CLAUDE.md` if any contract surface (labels, identity, install modes) was rephrased

## 3. Carve out follow-up changes

- [ ] 3.1 Scaffold the `shim-cli` change (proposal only) — implementation of `npx @dwmkerr/openspec-flow shim`
- [ ] 3.2 Scaffold the `shim-install-handler` change (proposal only) — Probot/Worker handler for `installation.created` and `installation_repositories.added`
- [ ] 3.3 Scaffold the `shim-drift-detector` change (proposal only) — daily scheduled drift check + PR opener
- [ ] 3.4 Scaffold the `retire-probot-runtime` change (proposal only) — remove runtime handlers from Probot once the shim path is fully covered

## 4. Verification

- [ ] 4.1 Re-run `openspec validate rfc-shim-architecture` after doc sync
- [ ] 4.2 Run repo lint and tests to confirm doc / spec edits introduced no parser regressions
- [ ] 4.3 Archive this change as part of the impl PR (per repo `CLAUDE.md`: `openspec archive rfc-shim-architecture --yes`)
