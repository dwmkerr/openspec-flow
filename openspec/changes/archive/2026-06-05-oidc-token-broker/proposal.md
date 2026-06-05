# oidc-token-broker

## Why

Distributing the App's private key as an Actions secret in every target repo (or even at org level) is the dominant onboarding friction for openspec-flow today. It's also a real security concern — the private key lets the holder mint installation tokens for every repo the App is installed on, so the secret has to be treated as carefully as the App itself.

Industry-comparable Apps you "install and forget" (CodeRabbit, Linear, Sentry, Mergify) run server-side and never touch the runner. Moving openspec-flow's dispatch core server-side is a large architectural shift with hosting + billing implications we don't want yet.

A middle ground exists and is well-attested (Sigstore, HashiCorp Vault, cloud-provider GitHub Actions auths all use it): **OIDC token broker**. The Probot service stays a thin coordinator; the workflow runs in the user's runner; at job-start the runner exchanges a GitHub-signed OIDC token for a short-lived App installation token via a small Probot endpoint. The private key never leaves the Probot host.

## What Changes

- **New**: `src/oidc-broker/index.ts` — pure broker function. Verifies the OIDC ID token against GitHub's JWKS (`token.actions.githubusercontent.com`), enforces `iss` / `aud` / `job_workflow_ref` claims, looks up the installation id for the claim's repo, mints a fresh installation token. Returns either `{ token, expires_at, repository }` or a structured `{ status, error }` failure.
- **New**: `src/oidc-broker/route.ts` — Express handler for `POST /api/token`. Reads bearer token, calls the broker, renders JSON.
- **New**: Probot mounts the route at `/api/token` when `OPENSPEC_FLOW_BROKER_AUDIENCE` env is set. Route is opt-in so existing deployments are unaffected.
- **New**: Reusable workflow `.github/workflows/openspec-flow.yml` gains a `Mint App token (OIDC broker)` step that runs when the target repo defines `OPENSPEC_FLOW_BROKER_URL` (repo or org variable). Falls back to the legacy `actions/create-github-app-token@v1` step when the broker URL is unset, preserving today's path during rollout.
- **New**: Shim template (`templates/openspec-flow.yml`) adds `id-token: write` permission so the runner can request OIDC tokens. Existing shims without this permission silently fall back to the legacy secret path (broker step is gated on the variable being set, but the permission is needed for the OIDC token request to succeed at all).
- **New**: `docs/oidc-broker.md` documents setup, trust model, smoke testing.
- **Out of scope**: production hosting, token-scope narrowing, HSM key storage, broker audit log, rate limiting. Tracked in #79 follow-ups.

## Capabilities

### New Capabilities

- `oidc-token-broker`: a stateless `POST /api/token` endpoint that exchanges a GitHub OIDC ID token for an App installation token, with `iss`/`aud`/`job_workflow_ref`/installation-existence checks and matching failure semantics. Replaces the per-repo App-secret distribution requirement.

### Modified Capabilities

- `openspec-flow`: the reusable workflow's token-mint priority becomes (1) broker exchange when `OPENSPEC_FLOW_BROKER_URL` set, (2) legacy `OPENSPEC_FLOW_APP_ID`/`PRIVATE_KEY` secrets when set, (3) `GITHUB_TOKEN` fallback. Documented in the workflow's `env:` block.

## Impact

- New module: `src/oidc-broker/` (index.ts, route.ts, tests).
- `src/index.ts`: route registration gated on `OPENSPEC_FLOW_BROKER_AUDIENCE` env.
- `.github/workflows/openspec-flow.yml`: new broker-mint step + token priority chain.
- `templates/openspec-flow.yml`: `id-token: write` permission.
- `package.json`: `jose` runtime dep (~50KB; CJS-compatible v5 to match Jest config).
- `jest.config.js`: no config change required — jose v5 ships CJS so the existing transform works.
- `.env.example`: documents `OPENSPEC_FLOW_BROKER_AUDIENCE`.
- `docs/oidc-broker.md`: setup + trust model + smoke loop.
- No change to the App's permission manifest (no new GitHub-side permission needed; the broker uses the App's existing identity).
- No change to the dispatch core, label contract, or intent classifier.
