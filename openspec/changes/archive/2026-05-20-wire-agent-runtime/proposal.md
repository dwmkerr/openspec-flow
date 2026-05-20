## Why

We can classify every relevant webhook event into an `Intent` and post
deterministic acks (eyes reaction + classifier comment). The next layer
is the agent itself — the thing that actually creates spec PRs,
iterates on them, and opens impl PRs.

Before wiring real handlers we need the runtime they all share: an
agent invocation layer (Claude Agent SDK), a CLI seam so Action mode
and App mode both call the same code, prompts loaded from adjacent
markdown files, and a streaming log formatter so the operator can
watch Claude think in the dev pane. This change ships the runtime
plus a stub `create-spec` handler that proves the plumbing end-to-end
without touching git or opening PRs.

## What Changes

- **Claude Agent SDK as the runtime**: programmatic Claude Code via
  `@anthropic-ai/claude-agent-sdk`. In-process inside Probot; same
  module called from the CLI. One `runAgent({ prompt, systemPrompt,
  cwd, log, options })` function that yields nothing — it consumes
  the SDK stream and feeds each chunk to a formatter that logs to the
  caller-supplied pino logger.
- **CLI seam (`openspec-flow handle <intent>`)**: thin command that
  routes to the same handler functions Probot calls. Lets Action mode
  invoke the agent over `npx openspec-flow handle create-spec --issue
  N --repo owner/repo` without re-implementing anything. Also a
  debug seam for humans.
- **Prompts as adjacent markdown**: `src/handlers/<intent>/prompt.md`
  read at module load. Readable in editor, reviewable in PRs, no
  template engine yet (interpolation by simple `{{var}}` replacement).
- **Stub `create-spec` handler**: receives issue context, builds prompt
  from `prompt.md`, calls `runAgent(...)`. The stub prompt asks Claude
  to "describe in 3 bullets what you would do for this issue" — no
  git, no file writes, no PR. End state proves Claude is reachable,
  streaming works, and logs are readable.
- **Format-chunk lifted from `dwmkerr/claude-code-agent`**:
  `src/agent/format-chunk.ts` adapts that repo's CLI-stream-json
  formatter to the Claude Agent SDK's `SDKMessage` union. Coloured
  per-role chunks, blue tool names, truncation to terminal width.
- **Dispatcher wired without a feature flag**: when the classifier
  returns `create-spec`, the dispatcher calls the handler stub. The
  stub is safe (no side effects beyond logs + one final comment with
  Claude's reply), so a runtime flag adds friction without value.
- **`.env.example` updated**: `ANTHROPIC_API_KEY`,
  `OPENSPEC_FLOW_WORKDIR` (default `/tmp/openspec-flow`),
  `OPENSPEC_FLOW_KEEP_WORKDIR` (default `false`).

## Capabilities

### New Capabilities

- `agent-runtime`: shared agent invocation layer. Defines the
  `runAgent` contract, the prompts-as-markdown convention, the
  streaming-log-formatter contract, and the env vars the runtime
  consumes.

### Modified Capabilities

- `intent-recognition`: dispatcher now calls a handler for the
  `create-spec` intent in addition to posting the eyes reaction and
  classifier comment. The classifier itself is unchanged.

## Impact

- New deps: `@anthropic-ai/claude-agent-sdk`, `chalk`.
- New files: `src/agent/run.ts`, `src/agent/format-chunk.ts`,
  `src/agent/format-chunk.test.ts`, `src/handlers/create-spec/index.ts`,
  `src/handlers/create-spec/prompt.md`,
  `src/handlers/create-spec/index.test.ts`, `src/cli.ts`,
  `.env.example` (or updated if present).
- Modified: `src/index.ts` (route `create-spec` → handler),
  `package.json` (deps + `bin` entry for CLI).
- Cost: one Claude API call per `create-spec` intent. Stub prompt is
  small (<200 tokens in, <200 out), so pennies per fire.

## Out of scope

- Real git ops, branch creation, PR opening — next change
  (`wire-create-spec-handler`).
- `iterate-spec`, `iterate-impl`, `create-impl` handlers — later.
- MCP tools / sub-agents / custom permission modes for the SDK —
  later, when handlers actually need them.
- Worker isolation (spawn subprocess per handler) — in-process is
  fine for now; we'll revisit if one handler blocks another.
- Repo cloning to a workdir — stub doesn't touch the filesystem, so
  `OPENSPEC_FLOW_WORKDIR` is declared but not yet consumed.
