# openspec-flow Specification Delta

## MODIFIED Requirements

### Requirement: Bot identity is github-actions[bot] by default, App identity is opt-in

The reusable workflow SHALL run as github-actions[bot] (using `GITHUB_TOKEN`) unless an OIDC broker URL is configured. The broker input SHALL be named `oidc_broker_url` (audience: `oidc_broker_audience`) and SHALL default to empty. The broker token-mint step SHALL run only when `oidc_broker_url` is non-empty or the `OPENSPEC_FLOW_BROKER_URL` variable is set; otherwise it SHALL be skipped and the flow SHALL proceed with `GITHUB_TOKEN`.

A repo that has the App installed and its broker URL baked into the shim (by `app-install`) SHALL continue to mint an App token unchanged. No shim SHALL need to set `oidc_broker_url: ''` to run as github-actions[bot].

#### Scenario: No broker configured → github-actions[bot]

- **GIVEN** a shim that does not set `oidc_broker_url` and a repo with no `OPENSPEC_FLOW_BROKER_URL` variable
- **WHEN** the reusable workflow runs
- **THEN** the broker step is skipped
- **AND** dispatch runs with `GITHUB_TOKEN` (github-actions[bot])

#### Scenario: Broker URL set → App identity

- **GIVEN** a shim with `with: oidc_broker_url: https://…` (or the `OPENSPEC_FLOW_BROKER_URL` variable set)
- **WHEN** the reusable workflow runs
- **THEN** the broker mints an App token and dispatch uses it
