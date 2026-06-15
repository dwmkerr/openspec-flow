# Release

How `openspec-flow` gets from a merged PR to a production Fly deploy. Conventional commits drive everything; there is no manual `flyctl deploy` in the happy path.

## The loop

```
PR opens                ──►  test job runs on the PR
PR merges to main       ──►  test + deploy-dev (immediate)
                        ──►  release-please opens/updates release PR
release PR merges       ──►  tag vX.Y.Z + GitHub Release
                        ──►  deploy-prod against fly.prod.toml
```

`.github/workflows/cicd.yaml` is the single source of truth for all four jobs. There is no separate "release" or "deploy" workflow.

## Conventional commits

Commit titles MUST follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Effect on version | Appears in CHANGELOG? |
|---|---|---|
| `feat:` | minor bump | yes, under **Features** |
| `fix:` | patch bump | yes, under **Bug Fixes** |
| `perf:` | patch bump | yes, under **Performance** |
| `docs:` | no bump | yes, under **Documentation** |
| `refactor:` | no bump | hidden |
| `test:` | no bump | hidden |
| `ci:` | no bump | hidden |
| `build:` | no bump | hidden |
| `chore:` | no bump | hidden |
| `BREAKING CHANGE:` in body | major bump (or minor pre-1.0) | yes |

Hidden types are still recorded in git; they just do not appear in `CHANGELOG.md`.

## The release PR

After every push to `main` that includes a non-hidden commit, `googleapis/release-please-action@v4` opens (or updates) a PR titled `chore(main): release X.Y.Z`. The PR contains:

- An updated `CHANGELOG.md`
- An updated `.github/release-please-manifest.json` (new version)
- An updated `package.json` `version` field

Review the diff. If the version bump and CHANGELOG entries look right, merge. **Merging that PR is the deploy.**

If you keep merging `feat:`/`fix:` PRs while the release PR is open, release-please force-pushes the release branch to keep the version bump and CHANGELOG current. No manual reconciliation needed.

## What actually deploys

| Job | Trigger | Deploys |
|---|---|---|
| `test` | PR + push to main | nothing (it just runs jest + typecheck + build) |
| `deploy-dev` | push to main (after `test` passes) | `openspec-flow-dev` on Fly |
| `release` | push to main | open/update the release PR (no deploy) |
| `deploy-prod` | push to main where `release_created` is true (i.e. release PR merged) | `openspec-flow` on Fly, from the tagged commit |

`deploy-prod` checks out `${{ needs.release.outputs.tag }}` (not `main`'s HEAD) so the prod image is byte-identical to the release commit even if other commits land on main during the deploy.

## Secrets the pipeline needs

| Secret | Scope | How to issue |
|---|---|---|
| `FLY_API_TOKEN_DEV` | repo | `fly tokens create deploy -a openspec-flow-dev --expiry 8760h` |
| `FLY_API_TOKEN_PROD` | repo | `fly tokens create deploy -a openspec-flow --expiry 8760h` |

Set with `gh secret set FLY_API_TOKEN_<DEV|PROD> --repo dwmkerr/openspec-flow`. Tokens are scoped per-Fly-app — a `_DEV` token cannot deploy prod.

Rotate tokens annually. The pipeline will start failing with `Could not find App ID` (or similar) when a token expires; that's the cue to re-issue. Old tokens can be listed via `fly tokens list -a <app>` and revoked via `fly tokens revoke <id>`.

## First release after this change lands

The first push to `main` after merging the release-pipeline change will:

1. Run `deploy-dev` (no-op for the version number — dev is already on this image).
2. Open a release PR `chore(main): release 0.1.0` (manifest starts at `0.0.0`; the first `feat:` commit bumps to `0.1.0`).

Merge it when ready. Prod deploys from the tag.

## Manual fallback — incident response only

If release-please is wedged or you need to deploy a specific commit out-of-band (rollback, emergency patch), use the manual path:

```bash
flyctl deploy --remote-only --config fly.prod.toml -a openspec-flow
```

You will need local flyctl auth (`fly auth login`) and `personal` org access. The repository's `FLY_API_TOKEN_*` secrets are not usable from a developer machine — they exist only in CI.

This path SHALL NOT be used in the normal flow. If you find yourself reaching for it, file an issue describing what went wrong with release-please so the loop can be fixed.

## Rolling back

If a prod deploy is bad, two options:

1. **Roll forward.** Open a `fix:` PR that reverts the bad change. Merge. release-please opens a patch release PR. Merge that. Total time: a few minutes.
2. **Roll back via Fly image history.** `flyctl releases -a openspec-flow` shows prior images; `flyctl deploy --image <previous-image-tag> -a openspec-flow` redeploys an earlier one. Faster than option 1 but skips the git history — only do this if the bad change is actively causing damage.

Option 1 is preferred because the git history stays the source of truth for what's in prod.
