# agent-runtime Specification

## Purpose
TBD - created by archiving change wire-agent-runtime. Update Purpose after archive.
## Requirements
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

### Requirement: Runtime SHALL NOT impose a reply-parsing convention on handlers

The runtime SHALL NOT impose any parsing convention on the string returned by `runAgent`; handlers MAY ignore the reply entirely and inspect the workdir filesystem to determine what the agent did.

#### Scenario: Handler reads filesystem instead of reply
- **GIVEN** the create-spec handler invokes the agent in a cloned
  workdir
- **WHEN** the agent returns
- **THEN** the handler lists `workdir/openspec/changes/` to find
  the agent's output rather than parsing the returned string

### Requirement: All Claude tools are allowed inside agent invocations by default

The runtime SHALL permit Read, Write, Edit, Bash, Glob, Grep, and
all other built-in Claude tools inside agent invocations unless a
handler explicitly narrows the allowlist via `opts.options.allowedTools`.
Restricting agent capabilities is the handler's concern, not the
runtime's.

#### Scenario: Default invocation has no tool restriction
- **WHEN** `runAgent({ prompt, cwd, log })` is called without
  `options.allowedTools`
- **THEN** the SDK is invoked with no `allowedTools` parameter and
  the agent has access to every built-in tool

