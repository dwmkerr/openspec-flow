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

### Requirement: Composite action inherits the caller's job environment

The composite action's steps run inside the caller's job and share its environment. Any variable the caller sets in the job `env` is therefore available to the dispatch step and to the Agent SDK it runs, with no per-variable declaration in the action. This covers `ANTHROPIC_BASE_URL`, `ANTHROPIC_CUSTOM_HEADERS`, model overrides, and any other variable the SDK reads.

Credentials MAY be supplied either as the `anthropic_api_key` / `claude_code_oauth_token` inputs or via the corresponding job env var; when both are absent for a given name, the input SHALL NOT overwrite an inherited value with an empty string.

#### Scenario: Custom headers inherited

- **GIVEN** a caller job that sets `env: ANTHROPIC_CUSTOM_HEADERS`
- **WHEN** the composite action dispatches
- **THEN** the dispatch step receives `ANTHROPIC_CUSTOM_HEADERS`

#### Scenario: Env-supplied credential is not clobbered

- **GIVEN** a caller job that sets `env: ANTHROPIC_API_KEY` and passes no `anthropic_api_key` input
- **WHEN** the composite action dispatches
- **THEN** the dispatch step still sees the inherited `ANTHROPIC_API_KEY`

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
