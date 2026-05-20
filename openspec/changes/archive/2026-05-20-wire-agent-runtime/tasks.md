# Tasks — wire-agent-runtime

## 1. Deps + env

- [ ] 1.1 `npm i @anthropic-ai/claude-agent-sdk chalk`
- [ ] 1.2 Add `.env.example` (or update if present) with
      `ANTHROPIC_API_KEY=`, `OPENSPEC_FLOW_WORKDIR=/tmp/openspec-flow`,
      `OPENSPEC_FLOW_KEEP_WORKDIR=false`
- [ ] 1.3 Confirm `.env` is gitignored (already is)

## 2. Agent runtime

- [ ] 2.1 Create `src/agent/format-chunk.ts` adapted from
      `dwmkerr/claude-code-agent/src/lib/format-chunk.ts`. Header
      comment credits source repo + commit hash. Switch input shape
      to the SDK's `SDKMessage` union.
- [ ] 2.2 Unit tests `src/agent/format-chunk.test.ts` cover each
      message type (system init, assistant text, assistant tool_use,
      user tool_result, result success, result error).
- [ ] 2.3 Create `src/agent/run.ts` exporting `runAgent(opts)` that
      wraps `query(...)`, feeds every chunk to the formatter, and
      logs via `opts.log.info(line)`. Returns final result text.
      Throws on missing `ANTHROPIC_API_KEY` and on `result.is_error`.

## 3. create-spec stub handler

- [ ] 3.1 Create `src/handlers/create-spec/prompt.md` — stub prompt
      that asks Claude to "describe in 3 bullets what you'd do".
      Use `{{issueNumber}}` and `{{issueTitle}}` placeholders.
- [ ] 3.2 Create `src/handlers/create-spec/index.ts` exporting
      `handleCreateSpec({ issueNumber, issueTitle, log })`. Loads
      prompt at module top, interpolates, calls `runAgent`.
- [ ] 3.3 Unit tests `src/handlers/create-spec/index.test.ts` mock
      `runAgent` and assert it receives the interpolated prompt.

## 4. CLI

- [ ] 4.1 Create `src/cli.ts` exporting `runCli(argv)` with a single
      subcommand: `handle create-spec --issue <n> --repo <owner/repo>`.
      Fetches issue title via `gh issue view` (or `octokit` if
      cleaner; gh is simpler).
- [ ] 4.2 Create `bin/openspec-flow` (executable) that calls
      `runCli(process.argv.slice(2))`.
- [ ] 4.3 Update `package.json` `bin` entry to point at it.

## 5. Dispatcher wiring

- [ ] 5.1 In `src/index.ts`, after `issues.createComment(...)`, when
      `intent.kind === "create-spec"` await
      `handleCreateSpec({ issueNumber, issueTitle: payload.issue.title,
      log: context.log })`. Wrap in try/catch; log errors, never
      re-throw.
- [ ] 5.2 Integration test extends `tests/integration/intent.test.ts`:
      mock `handleCreateSpec`, assert it's called on `create-spec`
      intent and NOT called on noop intents.

## 6. Verify + ship

- [ ] 6.1 `npm run test:all` passes
- [ ] 6.2 `npm run typecheck` passes
- [ ] 6.3 Local smoke: set `ANTHROPIC_API_KEY`, run
      `openspec-flow handle create-spec --issue 8 --repo
      dwmkerr/openspec-flow`, see Claude reply in stdout
- [ ] 6.4 Local smoke: label an issue with `openspec:go`, watch
      `make dev` pane see Claude reasoning lines
- [ ] 6.5 `openspec validate wire-agent-runtime` passes
- [ ] 6.6 Commit + push + open PR; archive in same PR per workflow
