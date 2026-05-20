# Design — wire-agent-runtime

## Architecture

```
                          ┌────────────────────┐
   webhook  ──Probot──►   │  src/index.ts      │ dispatcher
                          │  classify + route  │
                          └─────────┬──────────┘
                                    │
                                    │  (create-spec intent)
                                    ▼
                          ┌────────────────────┐
   CLI ───────────────►   │  src/handlers/     │
   (Action mode)          │  create-spec/      │
                          │  index.ts          │
                          └─────────┬──────────┘
                                    │
                                    ▼
                          ┌────────────────────┐
                          │  src/agent/run.ts  │  runAgent()
                          │  query() stream    │
                          └─────────┬──────────┘
                                    │
                                    ▼
                          ┌────────────────────┐
                          │  format-chunk.ts   │  per-chunk pretty
                          │  → log.info(...)   │  print
                          └────────────────────┘
```

The handler is the same function whether it's invoked by Probot or by
the CLI. The CLI is the seam that makes Action mode possible without
forking implementation.

## `runAgent` contract

```ts
interface RunAgentOpts {
  prompt: string;
  systemPrompt?: string;
  cwd?: string;
  log: Logger;                  // pino-compatible: log.info(string)
  options?: Partial<SDKOptions>; // pass-through to query()
}

async function runAgent(opts: RunAgentOpts): Promise<string>
```

Returns the final assistant text (the `result.result` from the
`SDKResultMessage`). Throws on `result.is_error`. Caller can ignore
the return value if it only wants the streamed logs.

The function consumes the async generator returned by `query(...)`,
formats every `SDKMessage` with `formatChunkPreview`, and calls
`log.info(formatted)` per chunk. No buffering, no batching — each
chunk lands in the logger as it arrives.

## Format-chunk adaptation

Source: `dwmkerr/claude-code-agent` `src/lib/format-chunk.ts`.
That formatter assumed CLI stream-json shape (`msg.content`,
`msg.subtype`, `msg.session_id`). The Agent SDK's `SDKMessage` union
is structured differently:

| CLI stream-json field | SDK `SDKMessage` equivalent |
|---|---|
| `msg.type === "system" && msg.subtype === "init"` | `SDKSystemMessage` with `subtype: "init"` |
| `msg.type === "system" && msg.subtype === "result"` | `SDKResultMessage` (separate `type: "result"`) |
| `msg.message.content[]` | `SDKAssistantMessage.message.content[]` |
| `msg.session_id` | same |

Adaptation is straightforward — colours, truncation, and the
per-content-block branches (`text`, `tool_use`, `tool_result`) carry
over unchanged. The only structural change: `result` is its own
top-level type in the SDK, not a `system` subtype.

Header comment in the new file credits the source repo + commit hash.

## Prompts as adjacent markdown

Each handler directory ships its prompt next to its code:

```
src/handlers/create-spec/
  index.ts       ← handler
  prompt.md      ← system prompt
```

`prompt.md` is loaded with `readFileSync(join(__dirname, "prompt.md"),
"utf8")` at module load (top-level, not per-call — prompts don't
change at runtime). Simple `{{varName}}` interpolation replaces
placeholders like `{{issueNumber}}` and `{{issueTitle}}`. No template
engine; if we outgrow this we add one later.

Rationale: markdown stays diff-friendly in PRs and editable in any
editor without TypeScript escaping. Co-locating with the handler
keeps the prompt and the consumer in lock-step.

## CLI

`src/cli.ts` exports a function `runCli(argv: string[])` and the
`package.json` `bin` entry points to a tiny `bin/openspec-flow` shim
that calls `runCli(process.argv.slice(2))`.

Initial subcommand:

```
openspec-flow handle create-spec --issue <n> --repo <owner/repo>
```

Reads `ANTHROPIC_API_KEY` from env, instantiates a pino logger
writing pretty-printed lines to stdout, calls `handleCreateSpec({
issueNumber, issueTitle: <fetched-via-gh>, log })`. No webhook
required.

Out of scope this change: subcommands for other intents (added when
their handlers land).

## Dispatcher wiring

`src/index.ts` `dispatch()` already posts eyes + comment for actionable
intents. After the comment, when `intent.kind === "create-spec"`, it
calls `handleCreateSpec({ issueNumber, issueTitle, log: context.log
})`. Errors from the handler are caught and logged; the bot does not
crash the webhook handler. A follow-up failure comment on the issue
is out of scope here (we'll add it when the handler does real work).

## Failure modes

| Failure | Behaviour |
|---|---|
| Missing `ANTHROPIC_API_KEY` | Handler throws at startup; dispatcher catches, log.error, no further side effects |
| Claude API 5xx / network | SDK retries internally; if final error, handler throws, dispatcher catches + logs |
| `result.is_error === true` | Handler throws with `result.errors.join(", ")`, dispatcher logs |
| Handler runtime > timeout | Out of scope — handler stub is bounded by a small prompt |

## Why no feature flag

The stub is read-only — it consumes one Claude API call per
`create-spec` intent and prints to logs. There is no behaviour that
needs gating. Adding a flag means another knob to forget, another
config-drift surface. When the next change wires real git ops, the
PR's reviewability + the merge moment is the gate.
