# release-pipeline Specification Delta

## ADDED Requirements

### Requirement: Conventional commits drive version bumps and CHANGELOG entries

The repository SHALL use [Conventional Commits](https://www.conventionalcommits.org/) for all merged commits on `main`. Release-please SHALL parse the commit history and open a release PR whose CHANGELOG and version bump reflect the merged commits since the last release.

Version bump rules (release-please defaults, `bump-minor-pre-major: true`):

- `feat:` → minor bump (e.g. 0.1.0 → 0.2.0 pre-1.0; 1.4.2 → 1.5.0 post-1.0)
- `fix:` → patch bump
- `perf:` → patch bump
- Any commit body containing `BREAKING CHANGE:` → major bump (or minor bump pre-1.0)
- `docs:`, `refactor:`, `test:`, `ci:`, `build:`, `chore:` → no version bump on their own; included for changelog if the type is not hidden

The CHANGELOG sections SHALL render `feat`, `fix`, `perf`, and `docs` as visible categories; `refactor`, `test`, `ci`, `build`, and `chore` SHALL be hidden but still recorded in the git history.

#### Scenario: feat commit opens a minor release PR

- **GIVEN** the current release is `v0.1.0` and the manifest reads `0.1.0`
- **AND** a PR with title `feat: add status endpoint` lands on `main`
- **WHEN** the release-please action runs on the push
- **THEN** a release PR titled `chore(main): release 0.2.0` is opened or updated
- **AND** the CHANGELOG entry under "Features" includes the commit summary

#### Scenario: fix commit opens a patch release PR

- **GIVEN** the current release is `v0.2.0`
- **AND** a PR with title `fix: handle null repo in classifier` lands on `main`
- **WHEN** release-please runs
- **THEN** the open release PR's title is `chore(main): release 0.2.1`

#### Scenario: chore commit does not bump the version

- **GIVEN** the current release is `v0.2.0` and no `feat`/`fix`/`perf` commits are pending
- **AND** a PR with title `chore: bump eslint to v9` lands on `main`
- **WHEN** release-please runs
- **THEN** no release PR is opened
- **AND** any existing release PR's version is unchanged

### Requirement: Dev Fly app deploys on every push to main

When a push lands on `main` and the `test` job passes, the workflow SHALL deploy the merged commit to the Fly app `openspec-flow-dev` using `flyctl deploy --remote-only --config fly.dev.toml -a openspec-flow-dev`. The deploy job SHALL authenticate with the repository secret `FLY_API_TOKEN_DEV`.

The dev deploy SHALL NOT be gated on release-please output. It runs on every passing main build so the dev host always reflects `HEAD` of main.

A `concurrency` group `deploy-dev` with `cancel-in-progress: false` SHALL serialise concurrent dev deploys so two rapid pushes do not produce out-of-order machine state.

#### Scenario: Successful main push deploys to dev

- **GIVEN** a PR merges to `main`
- **AND** the `test` job passes on all matrix versions
- **WHEN** the `deploy-dev` job runs
- **THEN** the job executes `flyctl deploy --remote-only --config fly.dev.toml -a openspec-flow-dev`
- **AND** the job reads `FLY_API_TOKEN_DEV` from repository secrets

#### Scenario: Concurrent pushes serialise

- **GIVEN** two `main` pushes occur within the deploy duration
- **WHEN** both `deploy-dev` jobs are queued
- **THEN** the second waits for the first to finish before starting
- **AND** neither is cancelled

#### Scenario: Failed test job blocks dev deploy

- **GIVEN** a PR merges to `main`
- **AND** the `test` job fails on any matrix version
- **WHEN** the workflow runs
- **THEN** the `deploy-dev` job does not execute

### Requirement: Production Fly app deploys only when release-please cuts a release

When release-please creates a tag (i.e. the `release_created` step output is truthy following the merge of a release PR), the workflow SHALL deploy the tagged commit to the Fly app `openspec-flow` using `flyctl deploy --remote-only --config fly.prod.toml -a openspec-flow`. The deploy job SHALL check out the release tag (not `main`'s `HEAD`) and SHALL authenticate with the repository secret `FLY_API_TOKEN_PROD`.

A `concurrency` group `deploy-prod` with `cancel-in-progress: false` SHALL serialise prod deploys.

The deploy-prod job SHALL NOT run on any other event: not on push to non-release commits, not on PR events, not on tags created outside the release-please flow.

#### Scenario: Release PR merge triggers prod deploy

- **GIVEN** release-please's release PR `chore(main): release 0.2.0` is merged to `main`
- **WHEN** the workflow runs on that push
- **THEN** the `release` job's `release_created` output is `true` and `tag_name` is `v0.2.0`
- **AND** the `deploy-prod` job checks out `v0.2.0`
- **AND** the job executes `flyctl deploy --remote-only --config fly.prod.toml -a openspec-flow`

#### Scenario: Non-release main push does not deploy prod

- **GIVEN** a non-release-please commit lands on `main` (e.g. a normal feat or fix PR)
- **WHEN** the workflow runs
- **THEN** the `release` job's `release_created` output is unset or `false`
- **AND** the `deploy-prod` job does not execute

#### Scenario: Manually-pushed tag does not deploy prod

- **GIVEN** an operator runs `git tag v0.2.1-hotfix && git push --tags`
- **WHEN** the workflow runs (it will not — `on:` listens for push to `main` and PRs only)
- **THEN** no deploy-prod job runs
- **AND** the operator MUST use the manual `flyctl deploy` fallback for hotfix deploys

### Requirement: Fly deploy tokens are per-app, not org-scoped

The repository SHALL store two distinct Fly deploy tokens as repository secrets:

- `FLY_API_TOKEN_DEV` — issued via `fly tokens create deploy -a openspec-flow-dev`. Authorised for `openspec-flow-dev` only.
- `FLY_API_TOKEN_PROD` — issued via `fly tokens create deploy -a openspec-flow`. Authorised for `openspec-flow` only.

The repository SHALL NOT use a single org-scoped Fly token for both apps. Compromise of one CI token SHALL NOT permit deploys to the other Fly app.

Tokens SHALL be issued with a finite expiry (default 8760 hours / 1 year) and rotated before expiry. Rotation is documented in `docs/release.md`.

#### Scenario: Dev token cannot deploy prod

- **GIVEN** `FLY_API_TOKEN_DEV` is exposed (e.g. leaked into a public log)
- **WHEN** an attacker attempts `flyctl deploy -a openspec-flow` with that token
- **THEN** the deploy SHALL fail with an authorisation error from Fly's API
- **AND** the `openspec-flow` machine state SHALL be unchanged

### Requirement: A new repository contributor can ship a change end-to-end without manual deploy commands

The release pipeline SHALL be the sole path from a merged conventional-commit PR to a deployed prod release. A contributor with merge rights but no Fly access SHALL be able to:

1. Open a feature PR with a `feat:` or `fix:` title.
2. Merge it to `main`.
3. See dev deploy automatically.
4. Wait for release-please to open or update the release PR.
5. Merge the release PR.
6. See prod deploy + a tagged GitHub Release automatically.

No step in the above sequence SHALL require running `flyctl`, `fly secrets`, `gh release`, or any local CLI. The manual `flyctl deploy` command documented in `docs/deploy-fly.md` SHALL be retained only as an incident-response fallback.

#### Scenario: Contributor without Fly access ships a fix

- **GIVEN** a contributor has GitHub write access but no Fly account
- **AND** they open PR `fix: handle missing label payload`
- **WHEN** the PR is reviewed, approved, and merged to `main`
- **THEN** dev deploys automatically with no manual action
- **AND** release-please updates the open release PR or opens one
- **WHEN** the release PR is reviewed and merged
- **THEN** prod deploys automatically
- **AND** the contributor never runs `flyctl` locally
