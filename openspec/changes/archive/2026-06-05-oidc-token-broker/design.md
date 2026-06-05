# Design: oidc-token-broker

## Context

The shim workflow mints an App installation token to push branches + open PRs under bot identity. Today that needs `OPENSPEC_FLOW_APP_ID` + `OPENSPEC_FLOW_PRIVATE_KEY` set as repo (or org) Actions secrets. The private key is sensitive, the friction is real, and there's no good answer to "what's the most idiomatic install path?" beyond Renovate's "paste your key" pattern.

GitHub-issued OIDC tokens give workflows a verifiable claim about who they are (repo, ref, workflow path). Verifying that claim server-side and minting an installation token in response removes the per-repo secret. The pattern is well-attested (Sigstore, HashiCorp Vault, the cloud-provider GitHub Actions auths).

Probot already holds the App's private key locally for webhook handling. Adding one endpoint that uses the same key to exchange OIDC → installation token is cheap. The architectural shape is: Probot is a coordinator + identity-mediator, the workflow remains the worker.

## Goals / Non-Goals

**Goals**:
- Target repos can mint an App installation token without holding the App's private key.
- One small endpoint on Probot, stateless, sub-second per call.
- Rollout is non-breaking: existing repos with legacy App secrets keep working; new repos can opt into the broker by setting a repo/org variable.
- Trust model documented; claim policy is conservative and easy to audit.

**Non-Goals**:
- Production hosting + abuse-policy review. Deferred per the user's "prod we come to later" call.
- Token-scope narrowing (mint installation tokens with a subset of the App's permissions). Defer.
- HSM-backed private key storage. Defer.
- Replacing the dispatch core's server-side execution path. Different conversation.

## Decisions

### D1. Stateless endpoint, one route

**Decision**: `POST /api/token` accepting `Authorization: Bearer <id_token>`. Body unused. Response is JSON `{ token, expires_at, repository }` on success or `{ error }` on failure with a 4xx/5xx status.

**Alternatives**: GraphQL endpoint (rejected — overkill); query-param token (rejected — bearer header is the convention); session cookies (rejected — broker is one-shot).

### D2. Trust model: `iss`, `aud`, `job_workflow_ref`, installation lookup

**Decision**: Four checks. Each maps to a known failure:

1. `iss` must be `https://token.actions.githubusercontent.com`. Rejects forged tokens from other issuers.
2. `aud` must equal the configured audience (default `openspec-flow`). Rejects tokens issued for some other service the same repo trusts.
3. `job_workflow_ref` (falling back to `workflow_ref`) must match the openspec-flow reusable workflow pattern. Rejects lateral-movement attempts — a malicious workflow inside an installed repo cannot mint a broker token by pretending to be openspec-flow.
4. The repo named in `repository` must be one the App is currently installed on. Rejects token requests for repos the App doesn't have access to.

**Why these four**: covers the three attack surfaces — forged issuer, wrong-audience replay, lateral movement inside an installed repo. The installation lookup makes the broker "fail closed" when a repo is uninstalled.

**Alternatives considered**:
- Verify `ref` (require `refs/heads/main` etc.). Rejected — too restrictive; users legitimately run openspec-flow from feature branches.
- Allow an env-configured allowlist of `repository_owner` values. Rejected for MVP; could land later if abuse appears.
- Verify `repository_id` is stable across renames. Worth considering; defer.

### D3. Reusable workflow chooses path at runtime via repo/org variable

**Decision**: The shim's reusable workflow caller now declares `id-token: write` permission. The reusable workflow adds a `Mint App token (OIDC broker)` step that runs `if: ${{ vars.OPENSPEC_FLOW_BROKER_URL != '' }}`. The legacy `Mint App token` step's guard becomes `if: ${{ vars.OPENSPEC_FLOW_BROKER_URL == '' && env.OPENSPEC_FLOW_APP_ID != '' }}`. Token priority at runtime: `broker → legacy App secrets → GITHUB_TOKEN`.

**Why**:
- Existing installs without the broker variable get the same behaviour they have today.
- Opting in is a single `gh variable set` command per repo or per org.
- The reusable workflow keeps a single token-priority chain visible in one place.

**Trade-off**: two parallel mint paths during rollout. Acceptable — the deprecation can land once usage shifts.

### D4. Endpoint is opt-in via `OPENSPEC_FLOW_BROKER_AUDIENCE`

**Decision**: The route mounts only when `OPENSPEC_FLOW_BROKER_AUDIENCE` env is set on Probot. Without it, the broker is disabled and Probot starts as before.

**Why**: keeps existing deployments unchanged; rolling the broker out is "set one env var + restart". Also means the audience is centrally configured server-side, not by the caller.

### D5. `jose` v5 for JWT + JWKS

**Decision**: Use `jose@5` (last CJS-supporting version) for JWT verification + JWKS caching. v6 is ESM-only and breaks the existing Jest setup.

**Alternatives**:
- `jsonwebtoken` + manual JWKS fetch. Rejected — re-implements code that already exists.
- Roll-our-own Node crypto verification. Rejected — risk of subtle bugs in signature checks.
- Switch the project to ESM. Rejected — large unrelated refactor.

### D6. Mint via Probot's existing `app.auth(installationId)`

**Decision**: `InstallationTokenIssuer.mintToken(installationId)` calls `app.auth(installationId)` (Probot's own auth surface) which uses the App's private key already loaded at boot. Avoids carrying a second copy of the private key in a separate `@octokit/auth-app` instance.

**Why**: single source of truth for App credentials; reuses Probot's caching where applicable.

## Risks / Trade-offs

- **Risk**: a malicious user with control over the Probot host could mint tokens for any installed repo. → **Mitigation**: this is the same trust footprint Probot already has (it holds the private key for webhook handling). The broker doesn't expand the attack surface.
- **Risk**: claim policy regression — accepting too-broad `job_workflow_ref` patterns could allow lateral movement. → **Mitigation**: pattern is anchored on `^dwmkerr/openspec-flow/\.github/workflows/openspec-flow\.yml@` so a forked repo couldn't impersonate. Tests cover the rejection case.
- **Risk**: JWKS endpoint unavailable. → **Mitigation**: `jose.createRemoteJWKSet` caches keys; first call after rotation may fetch fresh.
- **Trade-off**: the broker introduces a dependency on the Probot host being reachable from GitHub runners. If the host is down, workflows fall through to the legacy secret path (if set) or `GITHUB_TOKEN` (which can't push workflow files). Documented in the workflow file's env block.
- **Trade-off**: tokens minted have full installation permissions. Could be narrowed via the `permissions` parameter on the installation token endpoint, but adds API surface to the broker for marginal MVP benefit.

## Migration Plan

1. **Land code behind opt-in env + variable**. Existing repos unaffected; existing Probot deployments unaffected unless the audience env is set.
2. **Update `docs/oidc-broker.md`** with setup steps + smoke loop.
3. **Update `runAppInit` PR body** in a follow-up change to point at the broker option as the preferred path, with the legacy secrets as fallback.
4. **Smoke test against `dwmkerr/shellwright`** using cloudflared free tunnel. Verify:
   - Broker route mounts, returns 400 on missing token.
   - Reusable workflow's broker-mint step succeeds and produces a token.
   - Token can push to `.github/workflows/*`.
5. **Deprecate the legacy path** (`OPENSPEC_FLOW_APP_ID` / `OPENSPEC_FLOW_PRIVATE_KEY` secret) once production hosting + broker URL stabilises. Tracked separately.

**Rollback**: revert the change set. Existing repos with legacy secrets keep working unchanged.

## Open Questions

- **Q1**: Should the broker enforce a per-repo `OPENSPEC_FLOW_BROKER_AUDIENCE` (different audiences per installation) instead of one global? Probably overkill for MVP; defer until multiple Apps share one Probot.
- **Q2**: The reusable workflow's broker step uses `curl + jq`. Should we ship a small composite action that wraps this for cleaner UX in user-facing logs? Defer.
- **Q3**: Token scope minimisation — should we expose a `permissions` parameter on the broker so callers can narrow the token? GitHub's installation token endpoint supports it. Defer until a real use case appears.
