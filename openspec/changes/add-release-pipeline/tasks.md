# Tasks: add-release-pipeline

## 1. Pipeline + release config

- [x] 1.1 Add `.github/workflows/cicd.yaml` with `test` (matrix 22.x/24.x), `release` (release-please-action@v4), `deploy-dev` (gated on push to main), `deploy-prod` (gated on `release_created`).
- [x] 1.2 Add `.github/release-please-config.json` (Node release-type, `bump-minor-pre-major: true`, visible feat/fix/perf/docs sections, hidden refactor/test/ci/build/chore).
- [x] 1.3 Add `.github/release-please-manifest.json` seeded at `{".": "0.0.0"}`.
- [x] 1.4 Remove `.github/workflows/ci.yml` (superseded by `cicd.yaml`).
- [x] 1.5 `actionlint .github/workflows/cicd.yaml` passes clean.

## 2. Fly configuration split

- [x] 2.1 Rename `fly.toml` to `fly.dev.toml`. Preserve `auto_stop_machines = 'stop'`, `min_machines_running = 0`, `OPENSPEC_FLOW_BROKER_PUBLIC_URL=https://openspec-flow-dev.fly.dev`.
- [x] 2.2 Create `fly.prod.toml`: app `openspec-flow`, `auto_stop_machines = 'off'`, `min_machines_running = 1`, `OPENSPEC_FLOW_BROKER_PUBLIC_URL=https://openspec-flow.fly.dev`.
- [x] 2.3 `flyctl config validate --config fly.dev.toml` passes.
- [x] 2.4 `flyctl config validate --config fly.prod.toml` passes.

## 3. Prod provisioning (out-of-band, one-time)

- [x] 3.1 Activate prod GitHub App `openspec-flow`: enable webhook, set URL to `https://openspec-flow.fly.dev`, set permissions per `docs/app-setup.md` Step 1 table, subscribe to the seven events, set installation visibility to `Any account`.
- [x] 3.2 Generate prod App private key, download `.pem`.
- [x] 3.3 Generate prod webhook secret (`openssl rand -hex 32`), set on App + retain for Fly secret.
- [x] 3.4 `fly apps create openspec-flow --org personal`.
- [x] 3.5 `fly secrets set -a openspec-flow APP_ID=<id> PRIVATE_KEY=$(cat <pem>) WEBHOOK_SECRET=<secret> OPENSPEC_FLOW_BROKER_AUDIENCE=openspec-flow`.
- [x] 3.6 `flyctl deploy --remote-only --config fly.prod.toml -a openspec-flow` succeeds; Probot logs `Listening on http://0.0.0.0:3000`.
- [x] 3.7 `curl -X POST https://openspec-flow.fly.dev/api/token` returns `400 {"error":"missing bearer token"}`.
- [x] 3.8 Delete local prod `.pem` from `~/Downloads`.

## 4. CI deploy tokens

- [x] 4.1 `fly tokens create deploy -a openspec-flow --expiry 8760h` → `gh secret set FLY_API_TOKEN_PROD --repo dwmkerr/openspec-flow`.
- [x] 4.2 `fly tokens create deploy -a openspec-flow-dev --expiry 8760h` → `gh secret set FLY_API_TOKEN_DEV --repo dwmkerr/openspec-flow`.
- [x] 4.3 `gh secret list --repo dwmkerr/openspec-flow` shows both tokens present.

## 5. Sticky comment footer

- [x] 5.1 Add `SPONSOR_URL = "https://github.com/sponsors/dwmkerr"` constant in `src/handlers/shared/lifecycle-sticky.ts`.
- [x] 5.2 Update `footer()` to render `openspec-flow · docs · costs a little each month to host - please consider <sponsoring>` inside the existing right-aligned `<sub>`.
- [x] 5.3 Update `lifecycle-sticky.test.ts` footer test to assert sponsor URL + sponsoring anchor + hosting-cost phrase.
- [x] 5.4 `npx jest src/handlers/shared/lifecycle-sticky.test.ts` passes (15/15).
- [x] 5.5 `npm test` passes full suite (137/137).

## 6. Documentation

- [x] 6.1 Write `docs/release.md`: release loop diagram, conventional-commit guide, manual fallback, first-release version note, token rotation.
- [x] 6.2 Update `docs/deploy-fly.md`: release-driven deploy as default path; manual `fly deploy` repositioned as escape hatch; document `fly tokens create deploy` + per-app secret naming.
- [x] 6.3 Update `docs/app-setup.md` Step 0: expand "claim the slug" into the full prod-activation procedure used in section 3.
- [x] 6.4 Update `CLAUDE.md`: add `docs/release.md` to "files that depend on this contract"; brief Release subsection under Working style.
- [x] 6.5 Update `README.md`: add release badge under H1.

## 7. Validation

- [ ] 7.1 `openspec validate --change add-release-pipeline` passes.
- [ ] 7.2 Commit on `spike/release-pipeline`, push, open PR.
- [ ] 7.3 Merge spike PR → confirm `deploy-dev` succeeds → confirm release-please opens v0.1.0 PR → merge release PR → confirm `deploy-prod` succeeds → confirm `openspec-flow.fly.dev` serves the new image.
- [ ] 7.4 Archive change: `openspec archive add-release-pipeline --yes` as part of the impl PR (or follow-up PR if scope warrants).
