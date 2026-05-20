# agent-runtime Specification

## ADDED Requirements

### Requirement: Agent invocations use the Claude Agent SDK

All agent invocations SHALL go through a single `runAgent` function
that wraps `@anthropic-ai/claude-agent-sdk`'s `query()`. Handlers
SHALL NOT import the SDK directly.

#### Scenario: Handler invokes the agent
- **WHEN** a handler needs Claude to perform work
- **THEN** the handler calls `runAgent({ prompt, log, ... })` and the
  function consumes the SDK stream on its behalf

### Requirement: Every streamed message is logged via the formatter

`runAgent` SHALL feed every `SDKMessage` yielded by `query()` to a
formatter that returns a single human-readable line, and SHALL call
`log.info(line)` for each chunk synchronously as it arrives.

#### Scenario: Streaming chunks land in the logger in order
- **WHEN** the SDK yields a sequence of system / assistant / user /
  result messages
- **THEN** the formatter is called once per message and each
  formatted line is written to the supplied logger before the next
  message is read

### Requirement: Prompts live as adjacent markdown files

Each handler under `src/handlers/<intent>/` SHALL ship its system
prompt as a `prompt.md` file in the same directory. The handler
SHALL load it at module load with `readFileSync` and SHALL NOT
embed prompt text inline in TypeScript.

#### Scenario: Handler loads its prompt
- **GIVEN** a handler at `src/handlers/create-spec/`
- **WHEN** the module is loaded
- **THEN** `src/handlers/create-spec/prompt.md` is read once and
  cached for the lifetime of the process

### Requirement: Handlers are callable from both Probot and the CLI

Every handler SHALL export a pure function that takes a typed
options object (no `Context`, no `argv`) and SHALL be callable from
the Probot dispatcher and from `src/cli.ts` without modification.

#### Scenario: CLI runs the same handler as Probot
- **WHEN** a developer runs `openspec-flow handle create-spec --issue
  N --repo owner/repo`
- **THEN** the CLI calls the same `handleCreateSpec(opts)` function
  the Probot dispatcher calls, with options derived from the CLI
  arguments

### Requirement: Runtime configuration comes from environment variables

`runAgent` and its callers SHALL read `ANTHROPIC_API_KEY`,
`OPENSPEC_FLOW_WORKDIR` (default `/tmp/openspec-flow`), and
`OPENSPEC_FLOW_KEEP_WORKDIR` (default `false`) from `process.env`.
No values SHALL be hardcoded in source.

#### Scenario: Missing API key fails fast
- **WHEN** `runAgent` is called and `ANTHROPIC_API_KEY` is unset
- **THEN** `runAgent` throws before invoking the SDK and the error
  message names the missing variable
