# composite-action Specification Delta

## ADDED Requirements

### Requirement: Composite action runs the agent pipeline in the caller's job

openspec-flow SHALL provide a root `action.yml` composite action that executes the full agent pipeline — checkout, Node setup, build, OpenSpec CLI install, App-token minting, and dispatch — as a step within the caller's job.

Because a composite action runs inside the caller's job, it SHALL inherit the caller's job environment. Any `ANTHROPIC_*` or `CLAUDE_*` environment variable the caller sets SHALL be visible to the Agent SDK invoked by the dispatch step, without a corresponding declared input.

#### Scenario: Composite-direct caller sets a gateway base URL

- **GIVEN** a caller job that sets `env: ANTHROPIC_BASE_URL: https://gateway.internal/anthropic`
- **AND** a credential available as `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY`
- **WHEN** the caller invokes the composite action
- **THEN** the dispatch step runs with `ANTHROPIC_BASE_URL` set
- **AND** the Agent SDK routes requests to the gateway rather than `api.anthropic.com`

#### Scenario: No advanced env set → default endpoint

- **GIVEN** a caller job that sets only a credential input and no `ANTHROPIC_*` config env
- **WHEN** the caller invokes the composite action
- **THEN** the agent runs against the default Anthropic endpoint with no behavior change

### Requirement: Composite action forwards a curated config allowlist

The composite action SHALL forward a curated set of Anthropic configuration variables from the caller's job env to the dispatch step, each referenced explicitly (`${{ env.<NAME> }}`): at minimum `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, and `ANTHROPIC_CUSTOM_HEADERS`. It SHALL NOT blind-spread the entire caller environment.

#### Scenario: Custom headers forwarded

- **GIVEN** a caller job that sets `env: ANTHROPIC_CUSTOM_HEADERS`
- **WHEN** the composite action dispatches
- **THEN** the dispatch step receives `ANTHROPIC_CUSTOM_HEADERS`
- **AND** unrelated caller env vars outside the allowlist are not forwarded by openspec-flow's own env block

### Requirement: Composite action owns App-token minting

The composite action SHALL perform App-token minting using the broker → legacy App-secret → `GITHUB_TOKEN` priority chain, so that consumers invoking the composite directly retain App-bot identity without re-implementing OIDC.

The `id-token: write` permission required for the OIDC broker path SHALL remain the caller's responsibility, as a composite action cannot grant job permissions.

#### Scenario: Composite-direct caller keeps App identity

- **GIVEN** a caller job with `permissions: id-token: write` and a configured broker URL
- **WHEN** the composite action runs
- **THEN** it mints an App installation token via the broker
- **AND** dispatch uses the App-minted token rather than `GITHUB_TOKEN`

#### Scenario: Missing id-token permission falls back

- **GIVEN** a caller job without `id-token: write`
- **WHEN** the composite action runs with a broker URL configured
- **THEN** the broker mint cannot obtain an OIDC token
- **AND** minting falls back to the legacy secret path or `GITHUB_TOKEN` per the priority chain
