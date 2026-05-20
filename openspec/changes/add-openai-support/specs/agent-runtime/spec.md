## MODIFIED Requirements

### Requirement: Agent invocations use the Claude Agent SDK

All agent invocations SHALL go through a single `runAgent` function
that dispatches to an `AgentProvider` selected at runtime. The
default provider SHALL wrap `@anthropic-ai/claude-agent-sdk`'s
`query()` and SHALL be selected when `OPENSPEC_FLOW_AGENT_PROVIDER`
is unset or set to `claude`. Handlers SHALL NOT import any model SDK
directly.

#### Scenario: Handler invokes the agent
- **WHEN** a handler needs the agent to perform work
- **THEN** the handler calls `runAgent({ prompt, log, ... })` and the
  function consumes the active provider's stream on its behalf

#### Scenario: Default provider is Claude
- **GIVEN** `OPENSPEC_FLOW_AGENT_PROVIDER` is unset
- **WHEN** `runAgent` is called
- **THEN** the Claude Agent SDK provider handles the invocation

### Requirement: Every streamed message is logged via the formatter

`runAgent` SHALL feed every chunk yielded by the active provider to
a formatter that returns a single human-readable line, and SHALL
call `log.info(line)` for each chunk synchronously as it arrives.
The formatter SHALL handle chunks from every supported provider
(`SDKMessage` for Claude, response-stream events for OpenAI).

#### Scenario: Streaming chunks land in the logger in order
- **WHEN** the active provider yields a sequence of streaming chunks
- **THEN** the formatter is called once per chunk and each formatted
  line is written to the supplied logger before the next chunk is
  read

### Requirement: Runtime configuration comes from environment variables

`runAgent` and its callers SHALL read configuration exclusively from
`process.env`:

- `OPENSPEC_FLOW_AGENT_PROVIDER` (default `claude`, valid values
  `claude` and `openai`) selects the active provider.
- `ANTHROPIC_API_KEY` is required when the active provider is
  `claude`.
- `OPENAI_API_KEY` is required when the active provider is `openai`.
- `OPENSPEC_FLOW_WORKDIR` (default `/tmp/openspec-flow`) and
  `OPENSPEC_FLOW_KEEP_WORKDIR` (default `false`) are unchanged.

No values SHALL be hardcoded in source.

#### Scenario: Missing API key fails fast
- **WHEN** `runAgent` is called and the active provider's API key
  env var is unset
- **THEN** `runAgent` throws before invoking the SDK and the error
  message names both the missing variable and the active provider

#### Scenario: Unknown provider value rejected
- **WHEN** `OPENSPEC_FLOW_AGENT_PROVIDER` is set to a value other
  than `claude` or `openai`
- **THEN** `runAgent` throws on first invocation with an error
  listing the supported values

## ADDED Requirements

### Requirement: Providers are selected by environment, not by handler

Handlers SHALL NOT pass a provider name to `runAgent`. Provider
selection SHALL be process-wide and driven solely by
`OPENSPEC_FLOW_AGENT_PROVIDER`, so handler code stays identical
across providers.

#### Scenario: Handler code is unchanged across providers
- **GIVEN** a handler that calls `runAgent({ prompt, log, cwd })`
- **WHEN** the operator switches `OPENSPEC_FLOW_AGENT_PROVIDER`
  from `claude` to `openai`
- **THEN** the same handler code runs unmodified and produces the
  same `Promise<string>` shape
