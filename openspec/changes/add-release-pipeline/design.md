# Design: add-release-pipeline

## Context

Today's deploy is a `flyctl deploy -a openspec-flow-dev` typed at a terminal. No tag, no changelog, no audit trail of what shipped when. Prod doesn't exist as a Fly app yet — only the GitHub App slug `openspec-flow` is reserved (dormant) per `docs/app-setup.md` Step 0.

The user runs ~4 other projects on a near-identical pattern (`shellwright`, `effective-shell`, `dwmkerr.com`, `hacker-laws`): release-please opens a "chore(main): release X.Y.Z" PR after each conventional-commit merge; merging that PR creates a tag + GitHub Release; a deploy job gated on `release_created` ships the tagged code. Reusing the shape costs nothing and means contributors do not need to learn a bespoke release flow.

The hosting cost is real (~$2/mo on Fly's pay-as-you-go) but small. It is recouped by a single discreet sponsorship nudge in the lifecycle sticky comment — the only surface every openspec-flow user sees, and one we already render on every issue/PR.

## Goals / Non-Goals

**Goals**:
- One pipeline file (`cicd.yaml`) — test, release, dev-deploy, prod-deploy — instead of one per concern.
- Conventional commits drive the changelog; merging the release-please PR is the only path to a production tag.
- Per-app Fly deploy tokens so a compromised CI token cannot cross app boundaries.
- Prod deploys are explicit version events; dev deploys are continuous-main.
- The hosting-cost nudge is visible without being noisy.
- Docs explain the loop in one place, with the manual fallback documented for incident response.

**Non-Goals**:
- Container vulnerability scanning, SBOM, signed images. Worth doing later; not on this change.
- Multi-region prod. The webhook receiver is request/response; one region is fine until latency complaints arrive.
- Custom domain. `openspec-flow.fly.dev` is the contract today.
- A non-Fly target. We considered Cloudflare Workers + AWS Lambda; both require a non-trivial Probot port for marginal cost savings at current scale.
- A standalone "broker" deployment separate from Probot. Same process serves both today.
- Token-scope narrowing on the Fly deploy tokens (`deploy` scope already restricts to the named app — sufficient for now).

## Decisions

### D1. release-please over changesets / semantic-release

**Decision**: Use `googleapis/release-please-action@v4` with Node release-type, manifest-file mode.

**Why**:
- Sibling projects already use it; recognisability dominates marginal feature differences.
- The release PR is reviewable before tagging — important because the tag triggers prod deploy.
- Changelog generation, version bump in `package.json`, manifest tracking all in one tool.

**Alternatives**:
- **changesets**: requires per-PR changeset files. Heavier UX for a single-package repo.
- **semantic-release**: tags on every push, no review step. Removes the merge gate that protects prod.
- **Manual `npm version` + `gh release create`**: doesn't scale beyond one maintainer.

### D2. `release_created` output gates prod deploy, not tag push

**Decision**: `deploy-prod` job's `if:` is `${{ needs.release.outputs.released }}`. It depends on `[release]`, which runs on push to main and emits `release_created` only when release-please's PR was just merged.

**Why**:
- Single source of truth for "is this push a release?" — release-please's own output.
- Avoids a separate `on: push: tags:` workflow file that would duplicate the test job or skip it.
- A manually-created tag (e.g. `gh release create v0.1.0` for incident rollback) bypasses this guard intentionally — incident rollbacks should use the manual `flyctl deploy --image …` escape hatch documented in `docs/release.md`, not a hand-pushed tag.

**Alternatives**:
- `on: push: tags: ['v*']`: cleaner separation but couples to tag-naming convention and runs `test` again on the tag commit. Rejected.
- Manual `workflow_dispatch`: removes the "merge = ship" property. Rejected — that property is the point.

### D3. Per-app deploy tokens

**Decision**: Two repo secrets: `FLY_API_TOKEN_DEV` (scoped to `-a openspec-flow-dev`) and `FLY_API_TOKEN_PROD` (scoped to `-a openspec-flow`). Generated with `fly tokens create deploy -a <app> --expiry 8760h`.

**Why**:
- A Fly deploy token has full deploy authority on its target app. One-token-per-app caps blast radius.
- Dev deploys happen on every main push; prod deploys happen on release. Different surfaces, different audit trails — separate tokens reflect that.

**Alternatives**:
- Single `FLY_API_TOKEN` with org scope. Rejected — dev compromise would deploy prod.
- Per-environment GitHub Environments with secrets. Better long-term (adds approval gates) but defer to a follow-up — adds complexity without unblocking anything today.

### D4. Prod always-warm, dev auto-stops

**Decision**: `fly.prod.toml` sets `auto_stop_machines = 'off'` + `min_machines_running = 1`. `fly.dev.toml` keeps `auto_stop_machines = 'stop'` + `min_machines_running = 0`.

**Why**:
- The webhook receiver's cold-start is ~1s on Probot+Node. A user typing `openspec:go` and seeing the agent take 5–8 seconds to react reads as "broken". `min_machines_running = 1` is ~$2/mo well-spent.
- Dev is suspended most of the time anyway (`fly apps list` shows `suspended`). Auto-stop is the right default for a host nobody is actively watching.

**Trade-off**: prod cost rises from ~$0 to ~$2/mo. Sponsor nudge offsets this if it converts at all.

### D5. Sticky footer hosts the sponsorship nudge

**Decision**: Add a third link to `footer()` in `src/handlers/shared/lifecycle-sticky.ts`:
`openspec-flow · docs · costs a little each month to host - please consider sponsoring`.

**Why**:
- The lifecycle sticky is the single comment every openspec-flow user reads. README is for installers, not users.
- Right-aligned `<sub>` keeps the visual weight low; the nudge sits below the table and status headline, not above them.
- One line — no expanded copy, no emoji, no donation tiers.

**Alternatives**:
- README badge only. Rejected — invisible after install.
- Banner on every comment. Rejected — too intrusive.
- Top-of-comment sponsor block. Rejected — competes with the status headline.

### D6. CHANGELOG sections: visible vs hidden

**Decision**: Visible sections in CHANGELOG.md are `feat` → "Features", `fix` → "Bug Fixes", `perf` → "Performance", `docs` → "Documentation". Hidden (still parsed for version bumps): `refactor`, `test`, `ci`, `build`, `chore`.

**Why**:
- Users care about features, bug fixes, perf wins, and documentation improvements.
- `docs` is visible because openspec-flow is heavily docs-driven (per `effective-shell`'s precedent — that project does docs-as-features too).
- `refactor`/`test`/`ci`/`build`/`chore` add noise in a user-facing CHANGELOG. Still recorded in git for maintainer search.

### D7. First-release version starts at 0.0.0 in the manifest

**Decision**: `.github/release-please-manifest.json` starts `{ ".": "0.0.0" }`. First merged `feat:` bumps to `0.1.0` (pre-1.0 minor-bump semantics enabled by `bump-minor-pre-major: true`).

**Why**:
- Current `package.json` is `"version": "0.0.0"` — release-please reads from the manifest, not package.json, so we match.
- Pre-1.0, a `feat:` is a minor bump (signals expanding surface), `fix:` is a patch (signals fix-only). Standard release-please pre-1.0 setting.

## Risks

### Risk: First main-push after merging this change creates v0.1.0 prematurely

A feature commit in this very change ("feat: release pipeline + Fly prod") will be the first thing release-please sees. The release PR it opens will be v0.1.0, which we want — but it will deploy on merge. As long as prod is healthy at that moment (and it is, per the smoke test), this is fine. Documented in `docs/release.md`.

### Risk: Fly token leak in CI logs

Deploy tokens never appear in workflow logs (passed via `env:`, not `with:`). GitHub Actions automatically masks any secret value that appears in logs. Per-app scope caps damage if a leak does occur. Tokens are 1-year-expiry; rotate annually documented in `docs/release.md`.

### Risk: Cold start despite `min_machines_running = 1`

Fly occasionally restarts machines for maintenance. The two-machine config (one `lhr` + a high-availability pair on first deploy) means a restart on one machine still leaves the other serving. If both restart simultaneously, ~1s of cold start. Acceptable; alternative is multi-region at higher cost.

### Risk: Sponsor link rot

If the GitHub Sponsors profile changes URL, every existing sticky comment carries a dead link until the next mutation. Mitigation: GitHub Sponsors URLs are stable; the link goes through `github.com/sponsors/<user>` which is canonical. No additional mitigation needed.

### Risk: Release-please PR conflicts on the CHANGELOG

If two `feat:` commits land while the release PR is open, release-please updates the existing PR by force-pushing the release branch. No conflict — release-please owns that branch exclusively. Documented.

## Migration

No data, no schema, no behaviour change for existing users. The transition is:

1. Merge this PR. `ci.yml` is replaced by `cicd.yaml`. First push to main triggers `test` + `deploy-dev` (dev gets the new code immediately).
2. release-please opens a v0.1.0 PR within ~30s of merge.
3. Review the v0.1.0 PR (CHANGELOG.md content, version bump). Merge it.
4. The merge triggers `deploy-prod` against `openspec-flow` on Fly. First production release.
5. Subsequent feature work follows the normal loop: conventional commits → release PR auto-updates → merge to ship.

No rollback required — `cicd.yaml` is additive (the old `ci.yml`'s `test` job is preserved). If release-please malfunctions, the manual fallback is `flyctl deploy --remote-only --config fly.prod.toml -a openspec-flow`.
