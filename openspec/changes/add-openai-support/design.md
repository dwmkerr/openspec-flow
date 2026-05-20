## Context

`src/agent/run.ts` is the single entry point every handler uses to talk
to a model. It hard-imports `@anthropic-ai/claude-agent-sdk`, reads
`ANTHROPIC_API_KEY`, and streams `SDKMessage` chunks into the logger.
The Action mode runs `anthropics/claude-code-action@v1` in CI; the App
mode runs the Probot service which calls `runAgent` in-process.

Issue #38 (RFC: openai) asks for OpenAI support. Today an operator
who only has an OpenAI account cannot run the App mode at all. The
public flow, label contract, and PR mechanics are model-agnostic, so
the change is contained inside the agent runtime and its docs.

## Goals / Non-Goals

**Goals:**
- Let operators choose Claude or OpenAI for the App-mode agent runtime
  with one env var.
- Preserve the streaming/logging contract — handlers cannot tell which
  provider is in use.
- Keep `runAgent`'s public signature (`RunAgentOpts` → `Promise<string>`)
  byte-for-byte stable so no handler changes.
- Default to Claude when the selector is unset (zero-config upgrade).

**Non-Goals:**
- Action mode (`anthropics/claude-code-action@v1`) is not being
  replaced. That action is Anthropic-only; an OpenAI action is a
  separate, larger piece of work.
- Per-handler provider selection. Selector is process-wide.
- Model routing, fall-back chains, or cost-based dispatch.
- Tool-use parity beyond what current handlers need (read/write files
  via the SDK's built-in shell — both providers expose equivalents).

## Decisions

### Provider abstraction lives behind `runAgent`

Introduce `interface AgentProvider { run(opts: ProviderRunOpts):
Promise<string> }`. `runAgent` resolves the provider from
`process.env.OPENSPEC_FLOW_AGENT_PROVIDER` once per call, validates the
matching API key is present, and delegates. Each provider lives in
`src/agent/providers/<name>.ts`.

Alternative considered: branch on the env var inside `runAgent` with
inline `if/else`. Rejected — would blow up the file as providers
multiply and makes provider-specific unit tests awkward.

### OpenAI backend uses the Responses API via the `openai` Node SDK

The Responses API (`openai.responses.stream`) is OpenAI's current
streaming-first surface and is the closest analogue to Claude's
`query()` — single call, async-iterable of typed events, supports
system prompt + tools. The legacy Chat Completions API would force us
to invent our own streaming + tool loop.

Alternative considered: the `@openai/agents` SDK. Rejected for now —
it adds a second agent framework with its own opinions about tool
loops and would duplicate behaviour we already have in `runAgent`.
The Responses API is the smaller surface that fits our existing
contract.

### Event formatter is extended, not forked

`formatChunkPreview` today takes a Claude `SDKMessage`. Generalise it
to accept `{ kind: "claude", msg: SDKMessage } | { kind: "openai",
event: ResponseStreamEvent }` so a single formatter still produces one
log line per chunk. Keeps the streaming contract (`log.info` per
event) symmetrical across providers.

### Selector env var

`OPENSPEC_FLOW_AGENT_PROVIDER`, valid values `claude` (default) and
`openai`. Unknown values throw at startup with a clear error listing
the supported values. Lowercased before compare. Naming uses the
existing `OPENSPEC_FLOW_*` prefix (see `OPENSPEC_FLOW_CHAINED_MODE`).

### API key handling stays per-provider

Claude keeps `ANTHROPIC_API_KEY`, OpenAI gets `OPENAI_API_KEY`. The
selector picks one; the runtime asserts only the selected provider's
key is present and emits a single error if not. We deliberately do
not pre-validate the *other* key so operators can run with only the
key they need.

## Risks / Trade-offs

- **Provider drift over time** → both SDKs evolve. Mitigation: lock
  versions in `package.json`, gate behaviour changes through this
  same provider seam, and cover both paths in unit tests with mocked
  SDK clients.
- **Subtle tool/streaming semantic differences** → Claude streams
  `tool_use` blocks inside assistant messages; OpenAI streams typed
  events. Mitigation: the formatter normalises both into one log
  line; tool-use itself is not exercised by current handlers (they
  return text and the harness handles git/PR mechanics).
- **Action mode stays Claude-only** → operators may expect parity.
  Mitigation: README + architecture doc state the limitation
  explicitly; tracked as a follow-up RFC.
- **Cost/quality regressions** → no evaluation harness exists yet.
  Mitigation: ship a chainsaw e2e on a recorded fixture so the path
  is exercised, but treat OpenAI as opt-in until users report back.

## Migration Plan

1. Land code + tests behind the new env var. Default stays Claude;
   existing deployments are unaffected.
2. Document opt-in in `docs/app-setup.md` and `.env.example`.
3. Update Probot Fly deployment notes to mention adding
   `OPENAI_API_KEY` and setting the selector when an operator wants
   OpenAI.
4. Rollback: unset `OPENSPEC_FLOW_AGENT_PROVIDER` (or set to
   `claude`). No data migration, no schema change.

## Open Questions

- Do we want `OPENSPEC_FLOW_AGENT_MODEL` to override the default
  model per provider in this same change, or is `openai`/`claude`
  enough for v1? Current take: defer; default each provider to a
  sensible model (`gpt-4.1` and `claude-sonnet-4-5`) and add the
  knob later if users ask.
- Action mode parity (an `openai-codex-action` shim) — separate RFC.
