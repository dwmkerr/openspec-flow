# agent-runtime Specification Delta

## MODIFIED Requirements

### Requirement: Runtime configuration comes from environment variables

`runAgent` and its callers SHALL read Claude credentials, `OPENSPEC_FLOW_WORKDIR` (default `/tmp/openspec-flow`), and `OPENSPEC_FLOW_KEEP_WORKDIR` (default `false`) from `process.env`. Any one of the following credential env vars SHALL be sufficient: `CLAUDE_CODE_OAUTH_TOKEN` (Claude Code subscription token, recommended), `ANTHROPIC_API_KEY` (Anthropic API console key), or `ANTHROPIC_AUTH_TOKEN` (Anthropic-compatible gateway bearer token). No values SHALL be hardcoded in source.

#### Scenario: Missing all credentials fails fast

- **WHEN** `runAgent` is called and none of `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, or `ANTHROPIC_AUTH_TOKEN` is set
- **THEN** `runAgent` throws before invoking the SDK and the error message names all three accepted credential variables

#### Scenario: OAuth token alone satisfies the check

- **WHEN** `runAgent` is called with only `CLAUDE_CODE_OAUTH_TOKEN` set
- **THEN** `runAgent` proceeds to invoke the SDK

#### Scenario: API key alone satisfies the check

- **WHEN** `runAgent` is called with only `ANTHROPIC_API_KEY` set
- **THEN** `runAgent` proceeds to invoke the SDK

#### Scenario: Gateway bearer token alone satisfies the check

- **WHEN** `runAgent` is called with only `ANTHROPIC_AUTH_TOKEN` set
- **THEN** `runAgent` proceeds to invoke the SDK
