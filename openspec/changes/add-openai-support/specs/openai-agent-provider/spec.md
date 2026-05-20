## ADDED Requirements

### Requirement: OpenAI provider implements the AgentProvider contract

The OpenAI provider SHALL live at `src/agent/providers/openai.ts`
and SHALL export a function with signature compatible with
`runAgent`'s internal `AgentProvider.run(opts)` interface. It SHALL
accept the same `prompt`, optional `systemPrompt`, optional `cwd`,
and `log` fields exposed by `RunAgentOpts`, and SHALL return the
final assistant text as a `Promise<string>`.

#### Scenario: Provider returns final assistant text
- **GIVEN** `OPENSPEC_FLOW_AGENT_PROVIDER=openai` and a valid
  `OPENAI_API_KEY`
- **WHEN** `runAgent({ prompt, log })` is called
- **THEN** the OpenAI provider streams a response and resolves with
  the final assistant text string

### Requirement: OpenAI provider uses the official `openai` Node SDK

The provider SHALL call the OpenAI Responses API via the official
`openai` Node SDK using its streaming surface
(`openai.responses.stream` or equivalent). The provider SHALL NOT
hand-roll HTTP requests against the OpenAI REST endpoints.

#### Scenario: Provider streams via the SDK
- **WHEN** the OpenAI provider is invoked
- **THEN** it constructs an `OpenAI` client from the `openai`
  package and reads events from its streaming Responses API

### Requirement: OpenAI provider streams one log line per event

The OpenAI provider SHALL produce exactly one formatted log line via
the shared formatter for each event emitted by the Responses API
stream, and SHALL call `opts.log.info(line)` synchronously before
consuming the next event. This mirrors the Claude provider's
streaming contract so handlers observe identical log cadence.

#### Scenario: One log line per event
- **WHEN** the Responses stream yields N typed events
- **THEN** `opts.log.info` is called exactly N times, in order,
  before the provider returns

### Requirement: OpenAI provider surfaces API errors

The provider SHALL throw an `Error` whose message includes the
OpenAI error type and message when the SDK reports a request
failure, an aborted stream, or a non-success completion status. It
SHALL NOT swallow errors silently.

#### Scenario: Provider throws on stream failure
- **WHEN** the Responses stream errors mid-response
- **THEN** the provider throws an `Error` whose message names
  OpenAI as the source and includes the underlying error message

### Requirement: OpenAI provider has a default model

The provider SHALL invoke the Responses API with a default model
identifier when the caller does not specify one. The default SHALL
be configurable in a single constant inside
`src/agent/providers/openai.ts` so it can be bumped without
touching call sites.

#### Scenario: Default model used when none specified
- **WHEN** `runAgent` is called without a model override
- **THEN** the OpenAI provider passes its default model identifier
  to the Responses API
