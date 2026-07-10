# composite-action Specification Delta

## MODIFIED Requirements

### Requirement: Composite action owns App-token minting

The composite action SHALL perform App-token minting using the broker → App-secret → `github_token` priority chain. The broker input SHALL be named `oidc_broker_url` (audience: `oidc_broker_audience`) and default to empty. The broker step SHALL run only when `oidc_broker_url` is non-empty or the `OPENSPEC_FLOW_BROKER_URL` variable is set. When the broker is invoked but returns no token, the step SHALL fail with a message that names the repo, links the App install, and states that unsetting the broker runs the flow as github-actions[bot].

The `id-token: write` permission required for the broker path SHALL remain the caller's responsibility.

#### Scenario: Broker opted-in but App not installed → actionable error

- **GIVEN** a caller with `oidc_broker_url` set but the openspec-flow App not installed on the repo
- **WHEN** the composite action runs
- **THEN** the broker step fails with a message pointing at the App install and the opt-out
- **AND** the message is not a bare `exit 1`

#### Scenario: No broker → github-actions[bot], no failure

- **GIVEN** a caller with no `oidc_broker_url` and no `OPENSPEC_FLOW_BROKER_URL` variable
- **WHEN** the composite action runs
- **THEN** the broker step is skipped
- **AND** dispatch runs with `github_token`
