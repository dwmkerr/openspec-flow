# add-release-pipeline

## Why

openspec-flow has no version, no changelog, and no automated path from `main` to a Fly deploy. Every deploy today is a manual `fly deploy -a openspec-flow-dev` (or `…-prod`, when it eventually exists). That's fine for solo iteration; it doesn't survive contributors, post-incident "which version broke this?" questions, or a public install audience that needs a sponsor / support nudge.

Sibling projects (`shellwright`, `effective-shell`, `dwmkerr.com`) all use the same pattern: conventional-commit-driven release-please cuts a release PR; merging that PR tags the repo and triggers a deploy. We adopt the same shape so contributors recognise it on sight and there's exactly one path to production.

The Fly host runs on a credit card we now pay for (~$2/mo today, well into the thousands-of-installs range before that changes). Asking users to chip in via GitHub Sponsors costs us nothing and gives the only durable, non-intrusive surface — the lifecycle sticky comment — a one-line nudge.

## What Changes

- **New**: `.github/workflows/cicd.yaml` — single pipeline. Replaces the existing `.github/workflows/ci.yml`. PRs run the `test` matrix only; pushes to `main` run `test` + `deploy-dev` + the release-please job; tagging from a merged release-please PR runs `deploy-prod`.
- **New**: `.github/release-please-config.json` + `.github/release-please-manifest.json` — Node release-type, conventional-commit-driven CHANGELOG sections (`feat`, `fix`, `perf`, `docs` visible; `refactor`/`test`/`ci`/`build`/`chore` hidden).
- **Removed**: `.github/workflows/ci.yml` — superseded by `cicd.yaml`.
- **New**: `fly.dev.toml` (renamed from `fly.toml`, app `openspec-flow-dev`, auto-stop behaviour preserved).
- **New**: `fly.prod.toml` — app `openspec-flow`, `auto_stop_machines = 'off'`, `min_machines_running = 1` so prod stays warm and webhook delivery is never cold. `OPENSPEC_FLOW_BROKER_PUBLIC_URL=https://openspec-flow.fly.dev`.
- **New**: Repo secrets `FLY_API_TOKEN_DEV` + `FLY_API_TOKEN_PROD` — per-app deploy tokens scoped to a single Fly app each, so a leaked dev token cannot deploy prod (or vice versa).
- **Modified**: `src/handlers/shared/lifecycle-sticky.ts` — footer adds a third link: GitHub Sponsors (`https://github.com/sponsors/dwmkerr`) with one-line "costs a little each month to host" nudge. Surface chosen because the sticky is the most-viewed openspec-flow comment per issue.
- **New**: `docs/release.md` — single page explaining the release loop (conventional commit → release PR → merge → tag → deploy), manual fallback, secret rotation, first-release version note.
- **Modified**: `docs/deploy-fly.md` — manual `fly deploy` becomes the escape hatch; release-driven deploy is the default path. Documents `fly tokens create deploy` + `FLY_API_TOKEN_DEV/PROD` repo secrets.
- **Modified**: `docs/app-setup.md` — Step 0 expanded from "claim the slug" to a full prod activation procedure (webhook URL, permissions table, private-key download, `fly secrets set` invocation).
- **Modified**: `CLAUDE.md` — adds `docs/release.md` to "files that depend on this contract" and notes release flow under "Working style".
- **Modified**: `README.md` — release badge under H1.
- **Out of scope**: Cloudflare Workers / AWS Lambda port (deferred until Fly bill > $20/mo). Multi-region prod (single `lhr` region is enough). Container vulnerability scanning in CI (separate change). Custom domain (the `.fly.dev` URL is the contract today).

## Capabilities

### New Capabilities

- `release-pipeline`: defines (a) the conventional-commit → release-please → tag flow, (b) the gating of `deploy-dev` on every `main` push, (c) the gating of `deploy-prod` on release-please's `release_created` output, (d) the per-app Fly deploy token isolation requirement.

### Modified Capabilities

- `issue-lifecycle-comment`: the sticky-comment footer SHALL include a link to the project's GitHub Sponsors page accompanied by a single-line hosting-cost nudge. Surface remains right-aligned `<sub>`; visual weight unchanged.
- `openspec-flow`: the production Fly app `openspec-flow` SHALL run with `auto_stop_machines = 'off'` and `min_machines_running >= 1` so webhook delivery is never gated on cold start; the development Fly app `openspec-flow-dev` SHALL continue to auto-stop on idle for cost. Production deploys SHALL be tag-driven, not main-push-driven.

## Impact

- New file: `.github/workflows/cicd.yaml` (replaces `ci.yml`).
- New file: `.github/release-please-config.json`, `.github/release-please-manifest.json`.
- Rename: `fly.toml` → `fly.dev.toml`.
- New file: `fly.prod.toml`.
- Modified: `src/handlers/shared/lifecycle-sticky.ts` + `lifecycle-sticky.test.ts` (one footer line, one test assertion block).
- New file: `docs/release.md`.
- Modified: `docs/deploy-fly.md`, `docs/app-setup.md`, `CLAUDE.md`, `README.md`.
- New secrets: `FLY_API_TOKEN_DEV`, `FLY_API_TOKEN_PROD` on `dwmkerr/openspec-flow`.
- External: prod GitHub App `openspec-flow` activated (webhook URL, permissions, private key) — done out-of-band as part of this change; documented in `docs/app-setup.md`.
- External: prod Fly app `openspec-flow` provisioned with `WEBHOOK_SECRET`, `APP_ID`, `PRIVATE_KEY`, `OPENSPEC_FLOW_BROKER_AUDIENCE` secrets — done out-of-band as part of this change.
- No change to: the dispatch core, label contract, intent classifier, OIDC broker code, install/uninstall CLI, App's permission manifest.
