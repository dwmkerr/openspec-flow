# openspec-flow Specification Delta

## ADDED Requirements

### Requirement: Reusable workflow chooses App-bot identity at runtime via a priority chain

The reusable workflow SHALL resolve the App-bot identity token in priority order:

1. **OIDC broker** — when the caller's repo or org defines the variable `OPENSPEC_FLOW_BROKER_URL`, the workflow SHALL request a GitHub-issued OIDC token (audience `openspec-flow`), POST it to `<BROKER_URL>/api/token`, and use the returned installation token.
2. **Legacy App secrets** — when the broker variable is unset and the secrets `OPENSPEC_FLOW_APP_ID` + `OPENSPEC_FLOW_PRIVATE_KEY` are present, the workflow SHALL mint via `actions/create-github-app-token@v1`.
3. **`GITHUB_TOKEN` fallback** — when neither is configured, the workflow SHALL use `GITHUB_TOKEN`. Operators MUST be aware that `GITHUB_TOKEN` cannot push files under `.github/workflows/*`.

The shim template SHALL include `id-token: write` so runners can request OIDC tokens when the broker path is in use.

#### Scenario: Broker variable set → broker mint wins

- **GIVEN** `vars.OPENSPEC_FLOW_BROKER_URL` is set on the target repo and the broker is reachable
- **WHEN** the reusable workflow runs
- **THEN** the broker mint step produces a token
- **AND** the dispatch step's `GITHUB_TOKEN`/`OPENSPEC_FLOW_TOKEN` env vars resolve to the broker-minted token

#### Scenario: Broker variable absent, App secrets present → legacy path

- **GIVEN** `vars.OPENSPEC_FLOW_BROKER_URL` is unset but `secrets.OPENSPEC_FLOW_APP_ID` is non-empty
- **WHEN** the reusable workflow runs
- **THEN** the broker mint step is skipped
- **AND** the legacy mint step runs

#### Scenario: Neither configured → GITHUB_TOKEN

- **GIVEN** neither the broker variable nor the App secrets are set
- **WHEN** the reusable workflow runs
- **THEN** both mint steps are skipped
- **AND** dispatch runs with `GITHUB_TOKEN`
