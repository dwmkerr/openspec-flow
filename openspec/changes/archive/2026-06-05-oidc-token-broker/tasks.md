# Tasks: oidc-token-broker

## 1. Broker core

- [x] 1.1 Add `jose@5` runtime dep (CJS compatible for Jest).
- [x] 1.2 `src/oidc-broker/index.ts` — `verifyOidcToken()` + `broker()` with iss/aud/job_workflow_ref + installation lookup.
- [x] 1.3 `InstallationTokenIssuer` interface for getInstallationId + mintToken; concrete impl built from Probot's `app.auth(...)` surface.
- [x] 1.4 Unit tests with a local JWKS server + signed test JWTs (RS256): success path, missing token (400), wrong audience (401), wrong workflow_ref (401), 404 install lookup (403), mint failure (500).

## 2. HTTP route

- [x] 2.1 `src/oidc-broker/route.ts` — Express handler reading `Authorization: Bearer …`, calling broker, rendering JSON.
- [x] 2.2 Register route in `src/index.ts` via the Probot v13 `getRouter` option, gated on `OPENSPEC_FLOW_BROKER_AUDIENCE`.
- [x] 2.3 Boot log line `oidc-broker mounted at /api/token (audience=…)` or `oidc-broker disabled`.

## 3. Workflow integration

- [x] 3.1 `.github/workflows/openspec-flow.yml` adds `Mint App token (OIDC broker)` step gated on `vars.OPENSPEC_FLOW_BROKER_URL`.
- [x] 3.2 Legacy `Mint App token` step's `if:` extended to skip when broker variable is set.
- [x] 3.3 Token resolution priority updated in `Dispatch` step env: broker → legacy → GITHUB_TOKEN.
- [x] 3.4 `templates/openspec-flow.yml` adds `id-token: write` permission.

## 4. Docs

- [x] 4.1 `docs/oidc-broker.md` — diagram, setup (Probot side + repo side), trust model, smoke loop.
- [x] 4.2 `.env.example` documents `OPENSPEC_FLOW_BROKER_AUDIENCE`.

## 5. Validation + smoke

- [x] 5.1 `npm run build && npm test` green locally (118 tests pass; 6 new for broker).
- [x] 5.2 `openspec validate oidc-token-broker` green.
- [x] 5.3 Smoke (local): start Probot with the env set, confirm boot log + `curl POST /api/token` returns 400 without bearer.
- [ ] 5.4 Smoke (live): expose Probot via cloudflared tunnel, set `OPENSPEC_FLOW_BROKER_URL` repo variable on a sandbox repo, trigger an actionable event, verify broker step succeeds + push of workflow file works.
- [ ] 5.5 Smoke (live): confirm legacy secret path still works when broker variable is unset (regression check).
