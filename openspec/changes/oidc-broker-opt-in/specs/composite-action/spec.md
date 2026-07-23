# composite-action Specification Delta

## MODIFIED Requirements

### Requirement: Composite action owns App-token minting

The composite action SHALL perform App-token minting using the broker → App-secret → `github_token` priority chain. The broker input SHALL be named `oidc_broker_url` (audience: `oidc_broker_audience`) and default to empty. The broker step SHALL run only when `oidc_broker_url` is non-empty. The composite action SHALL NOT access the `vars` context, which is unavailable while GitHub loads composite action metadata; reusable-workflow callers SHALL resolve any `OPENSPEC_FLOW_BROKER_URL` override before passing this input. When the broker is invoked but returns no token, the step SHALL fail with a message that names the repo, links the App install, and states that unsetting the broker runs the flow as github-actions[bot].

The `id-token: write` permission required for the broker path SHALL remain the caller's responsibility.

#### Scenario: Broker opted-in but App not installed → actionable error

- **GIVEN** a caller with `oidc_broker_url` set but the openspec-flow App not installed on the repo
- **WHEN** the composite action runs
- **THEN** the broker step fails with a message pointing at the App install and the opt-out
- **AND** the message is not a bare `exit 1`

#### Scenario: No broker → github-actions[bot], no failure

- **GIVEN** a caller with no `oidc_broker_url`
- **WHEN** the composite action runs
- **THEN** the broker step is skipped
- **AND** dispatch runs with `github_token`

#### Scenario: Reusable workflow resolves the repository variable

- **GIVEN** a reusable-workflow caller with `OPENSPEC_FLOW_BROKER_URL` set
- **WHEN** the reusable workflow invokes the composite action
- **THEN** it passes the variable's value as `oidc_broker_url`
- **AND** the composite manifest contains no direct `vars` context reference
