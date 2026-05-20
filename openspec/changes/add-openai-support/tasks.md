## 1. Provider abstraction

- [ ] 1.1 Define `AgentProvider` interface and `ProviderRunOpts` type in `src/agent/providers/types.ts`
- [ ] 1.2 Add provider-selector helper in `src/agent/providers/select.ts` reading `OPENSPEC_FLOW_AGENT_PROVIDER` (default `claude`), throwing on unknown values
- [ ] 1.3 Extract current Claude code path into `src/agent/providers/claude.ts` implementing `AgentProvider`
- [ ] 1.4 Refactor `src/agent/run.ts` to call the selected provider; keep public `runAgent` / `RunAgentOpts` signatures unchanged
- [ ] 1.5 Move the per-provider API-key check into each provider (Claude → `ANTHROPIC_API_KEY`, OpenAI → `OPENAI_API_KEY`) so `runAgent` only validates the active one

## 2. OpenAI provider

- [ ] 2.1 Add `openai` to `package.json` dependencies and pin a version
- [ ] 2.2 Implement `src/agent/providers/openai.ts` using `openai.responses.stream`
- [ ] 2.3 Wire `systemPrompt`, `cwd`-aware prompt, and final-text return path
- [ ] 2.4 Add `OPENAI_DEFAULT_MODEL` constant in the provider file with a sensible default
- [ ] 2.5 Surface OpenAI SDK errors as `Error` with provider-tagged message

## 3. Streaming + formatter

- [ ] 3.1 Generalise `formatChunkPreview` to accept `{ kind: "claude", msg } | { kind: "openai", event }`
- [ ] 3.2 Ensure each OpenAI Responses event produces exactly one `log.info` call
- [ ] 3.3 Update Claude provider to pass `{ kind: "claude", msg }` into the formatter

## 4. Tests

- [ ] 4.1 Unit-test provider selector (default, `claude`, `openai`, invalid)
- [ ] 4.2 Unit-test `runAgent` dispatch with mocked providers (asserts handler-visible signature is stable)
- [ ] 4.3 Unit-test OpenAI provider with a mocked `openai` client (streaming chunks → log calls in order, final text returned, errors surfaced)
- [ ] 4.4 Extend Claude provider tests to cover the new provider-tagged formatter input
- [ ] 4.5 Add a chainsaw/e2e smoke that runs one handler end-to-end with `OPENSPEC_FLOW_AGENT_PROVIDER=openai` against a recorded fixture

## 5. Configuration + docs

- [ ] 5.1 Update `.env.example` with `OPENSPEC_FLOW_AGENT_PROVIDER` and `OPENAI_API_KEY`
- [ ] 5.2 Document both providers and the selector in `docs/app-setup.md` and `docs/developer-guide.md`
- [ ] 5.3 Update `docs/architecture.md` LLM layer section to describe the provider abstraction and call out that Action mode remains Claude-only
- [ ] 5.4 Update `README.md` to mention OpenAI as an opt-in App-mode provider
- [ ] 5.5 Update Fly deployment notes to add `OPENAI_API_KEY` as an optional secret

## 6. Validation

- [ ] 6.1 Run `openspec validate add-openai-support` and resolve any issues
- [ ] 6.2 Run `npm test` and confirm all new and existing tests pass
- [ ] 6.3 Manual smoke: run `openspec-flow handle create-spec` against a throwaway issue with each provider
