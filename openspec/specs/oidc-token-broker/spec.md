# oidc-token-broker Specification

## Purpose
TBD - created by archiving change oidc-token-broker. Update Purpose after archive.
## Requirements
### Requirement: Stateless `POST /api/token` endpoint exchanges OIDC for installation tokens

When `OPENSPEC_FLOW_BROKER_AUDIENCE` is set in Probot's environment, the App SHALL mount a `POST /api/token` route. The route SHALL read a bearer token from the `Authorization` header, treat it as a GitHub-issued OIDC ID token, and exchange it for a fresh App installation token. On success, the route SHALL respond with HTTP 200 and JSON `{ token, expires_at, repository }`. On failure, the route SHALL respond with HTTP 400/401/403/500 and JSON `{ error }` per the failure semantics below.

When `OPENSPEC_FLOW_BROKER_AUDIENCE` is unset, the route SHALL NOT be mounted and Probot SHALL log `oidc-broker disabled` on boot. Existing deployments without the env var SHALL continue working unchanged.

#### Scenario: Route disabled by default

- **GIVEN** Probot boots without `OPENSPEC_FLOW_BROKER_AUDIENCE` set
- **WHEN** any HTTP request hits `POST /api/token`
- **THEN** the server returns a non-route response (404 or framework default)
- **AND** the boot log includes `oidc-broker disabled`

#### Scenario: Route enabled by env

- **GIVEN** `OPENSPEC_FLOW_BROKER_AUDIENCE=openspec-flow` is set
- **WHEN** Probot boots
- **THEN** the boot log includes `oidc-broker mounted at /api/token (audience=openspec-flow)`

#### Scenario: Missing bearer token

- **WHEN** a request without `Authorization: Bearer …` reaches the route
- **THEN** the response is HTTP 400 with body `{ "error": "missing bearer token" }`

### Requirement: OIDC token verification enforces issuer, audience, and workflow ref

The broker SHALL verify the bearer token's signature against the JWKS at `https://token.actions.githubusercontent.com/.well-known/jwks`, SHALL require `iss === "https://token.actions.githubusercontent.com"`, SHALL require `aud === <configured audience>`, and SHALL require `job_workflow_ref` (or `workflow_ref` when the former is absent) to match the pattern `^dwmkerr/openspec-flow/\.github/workflows/openspec-flow\.yml@`. Any failure SHALL result in HTTP 401 with a descriptive `{ "error": "…" }` body.

#### Scenario: Wrong audience rejected

- **WHEN** an OIDC token with `aud` differing from the configured audience reaches the route
- **THEN** the response is HTTP 401 with an error mentioning audience verification

#### Scenario: Mismatched workflow ref rejected

- **WHEN** an OIDC token's `job_workflow_ref` does not match the openspec-flow reusable workflow pattern
- **THEN** the response is HTTP 401 with an error mentioning the workflow ref

#### Scenario: Valid token from a recognised repo accepted

- **GIVEN** a valid OIDC token whose `repository` claim names a repo the App is installed on
- **WHEN** the token reaches the route
- **THEN** the response is HTTP 200 with JSON `{ token, expires_at, repository }`
- **AND** `repository` echoes the claim

### Requirement: Broker refuses tokens for uninstalled repos

The broker SHALL look up the App installation id for the claim's `repository` via the GitHub API. When the lookup returns 404 (App not installed), the broker SHALL respond with HTTP 403 and `{ "error": "App is not installed on <owner/repo>, or installation lookup failed" }`.

#### Scenario: App not installed → 403

- **GIVEN** an OIDC token whose `repository` claim names `owner/orphan-repo` where the App is not installed
- **WHEN** the token reaches the route
- **THEN** the response is HTTP 403 with an error naming the missing installation

### Requirement: Reusable workflow prefers broker over legacy App secrets

The reusable workflow `.github/workflows/openspec-flow.yml` SHALL include a token-mint step (`Mint App token (OIDC broker)`) that runs when the caller's repo/org defines the variable `OPENSPEC_FLOW_BROKER_URL`. The step SHALL request an OIDC token with `audience=openspec-flow`, POST it to `${OPENSPEC_FLOW_BROKER_URL}/api/token`, and expose the returned token as a step output. The token resolution priority for the subsequent `Dispatch` step SHALL be: broker output → legacy App-secret output → `GITHUB_TOKEN`.

The shim template (`templates/openspec-flow.yml`) SHALL include `id-token: write` in its `permissions:` block so runners can request OIDC tokens.

#### Scenario: Repo with broker variable uses broker mint

- **GIVEN** a target repo with the shim merged and `OPENSPEC_FLOW_BROKER_URL` set as a repo variable, and the broker is reachable
- **WHEN** an actionable openspec-flow workflow runs
- **THEN** the broker step succeeds and produces a non-empty `token` output
- **AND** the legacy App-secret step is skipped
- **AND** the `Dispatch` step receives the broker-minted token

#### Scenario: Repo without broker variable falls back to legacy secrets

- **GIVEN** a target repo where `OPENSPEC_FLOW_BROKER_URL` is unset but `OPENSPEC_FLOW_APP_ID` and `OPENSPEC_FLOW_PRIVATE_KEY` are present
- **WHEN** the workflow runs
- **THEN** the broker step is skipped (condition false)
- **AND** the legacy App-secret step runs and produces a token

#### Scenario: Neither broker nor legacy → GITHUB_TOKEN fallback

- **GIVEN** a target repo with neither `OPENSPEC_FLOW_BROKER_URL` nor the App secrets configured
- **WHEN** the workflow runs
- **THEN** both mint steps are skipped
- **AND** `Dispatch` runs with `GITHUB_TOKEN`

