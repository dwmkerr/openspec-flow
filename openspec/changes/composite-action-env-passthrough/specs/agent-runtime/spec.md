# agent-runtime Specification Delta

## MODIFIED Requirements

### Requirement: Agent run accepts OAuth, API-key, or bearer authentication

The agent runtime SHALL permit the agent to run when `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, or `ANTHROPIC_AUTH_TOKEN` is present in the environment. It SHALL fail with an actionable error only when all three are absent. The error message SHALL name every supported variable.

This supports Claude Code subscription authentication (`CLAUDE_CODE_OAUTH_TOKEN`) and gateways that authenticate with a bearer token (`ANTHROPIC_AUTH_TOKEN`) in place of an API key (`ANTHROPIC_API_KEY`).

#### Scenario: Claude Code OAuth token only

- **GIVEN** `CLAUDE_CODE_OAUTH_TOKEN` is set and the API-key and gateway-token variables are unset
- **WHEN** the agent runs
- **THEN** the run proceeds and the SDK authenticates with the Claude subscription token

#### Scenario: Bearer token only

- **GIVEN** `ANTHROPIC_AUTH_TOKEN` is set and `ANTHROPIC_API_KEY` is unset
- **WHEN** the agent runs
- **THEN** the run proceeds and the SDK authenticates with the bearer token

#### Scenario: API key only

- **GIVEN** `ANTHROPIC_API_KEY` is set and `ANTHROPIC_AUTH_TOKEN` is unset
- **WHEN** the agent runs
- **THEN** the run proceeds unchanged from prior behavior

#### Scenario: No credential present

- **GIVEN** none of `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, or `ANTHROPIC_AUTH_TOKEN` is set
- **WHEN** the agent runs
- **THEN** it throws an error naming all three variables

## ADDED Requirements

### Requirement: Agent runtime honors SDK environment configuration

The agent runtime SHALL rely on the Agent SDK's native reading of Anthropic environment variables (including `ANTHROPIC_BASE_URL`) from `process.env` for endpoint and transport configuration. The runtime SHALL NOT add bespoke routing logic; configuration reaches the SDK through the process environment established by the composite action.

#### Scenario: Base URL sourced from environment

- **GIVEN** `ANTHROPIC_BASE_URL` is present in the runtime's `process.env`
- **WHEN** the agent invokes the SDK
- **THEN** the SDK directs requests to that base URL
- **AND** no openspec-flow code parses or forwards `ANTHROPIC_BASE_URL` explicitly
