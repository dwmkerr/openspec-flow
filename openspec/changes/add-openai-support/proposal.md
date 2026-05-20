## Why

Issue #38 asks whether openspec-flow can run on OpenAI in addition to
Claude. The agent runtime is currently hard-wired to the Claude Agent
SDK and `ANTHROPIC_API_KEY`, so any team without an Anthropic contract
cannot self-host openspec-flow. Adding OpenAI as an alternative
provider removes that lock-in, lets users pick the model that best fits
their cost/quality envelope, and is a prerequisite for future
multi-provider evaluations.

## What Changes

- Introduce a provider abstraction inside `src/agent/run.ts` so
  `runAgent()` dispatches to a pluggable backend instead of importing
  the Claude SDK directly.
- Add an OpenAI backend implemented against the official `openai`
  Node SDK (Responses API with tool/streaming parity to the current
  Claude path).
- Select the active provider via `OPENSPEC_FLOW_AGENT_PROVIDER`
  (`claude` | `openai`, default `claude`). Each provider keeps its own
  env-var key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).
- Keep the existing `RunAgentOpts` shape and streaming contract
  (one formatted log line per chunk, final assistant text returned).
- Update docs (`README.md`, `docs/architecture.md`,
  `docs/developer-guide.md`, `docs/app-setup.md`, `.env.example`) to
  document both providers and the selector variable.
- **NON-GOAL**: replacing Claude as the default, swapping the
  Action-mode `anthropics/claude-code-action`, or supporting
  per-handler provider overrides. Those land in follow-ups if
  warranted.

## Capabilities

### New Capabilities
- `openai-agent-provider`: OpenAI-backed implementation of the
  `runAgent` contract, including streaming, prompt/system-prompt
  wiring, working-directory handling, and error surfacing.

### Modified Capabilities
- `agent-runtime`: `runAgent` is no longer required to use the Claude
  Agent SDK directly. Instead it SHALL dispatch to a provider
  selected at runtime, of which Claude remains the default. The
  streaming/logging/prompt-file requirements stay unchanged.

## Impact

- Code: `src/agent/run.ts`, new `src/agent/providers/claude.ts` and
  `src/agent/providers/openai.ts`, new provider-selector helper, and
  the `format-chunk` formatter (extended to handle OpenAI events).
- Dependencies: add `openai` (Node SDK) to `package.json`.
- Configuration: new `OPENSPEC_FLOW_AGENT_PROVIDER` and
  `OPENAI_API_KEY` env vars; `.env.example`, Action workflow shim,
  and App deployment secrets need both keys when the operator opts
  into OpenAI.
- Docs: README, architecture, developer guide, app setup.
- Tests: extend agent-runtime unit tests to cover provider selection,
  add OpenAI provider tests with a mocked SDK, and a chainsaw/e2e
  smoke that runs one handler end-to-end with `provider=openai`
  against a recorded fixture.
- Backward compatibility: default behaviour (Claude) is unchanged
  when the new env var is unset.
