# Release

```
PR merges to main       ──►  test + deploy-dev (immediate)
                        ──►  release-please opens/updates release PR
release PR merges       ──►  tag vX.Y.Z + GitHub Release + deploy-prod
```

`.github/workflows/cicd.yaml` runs all four jobs (`test`, `release`, `deploy-dev`, `deploy-prod`). `deploy-prod` is gated on release-please's `release_created` output — manually-pushed tags do NOT deploy prod.

Conventional commit prefixes: `feat:` minor bump, `fix:`/`perf:` patch bump, `docs:` no bump (CHANGELOG only), `refactor:`/`test:`/`ci:`/`build:`/`chore:` hidden + no bump. `BREAKING CHANGE:` in commit body → major (or minor pre-1.0). Standard release-please pre-1.0 config (`bump-minor-pre-major: true`).

For manual / hotfix deploys see [`deploy-fly.md`](./deploy-fly.md) — release-please path is the default; manual `flyctl deploy` is the escape hatch.
