# Tasks: composite-action-env-passthrough

## 1. Composite action

- [x] 1.1 Add root `action.yml` (`using: composite`) with steps: mint App token → setup-node → build (at `action_path`) → install OpenSpec CLI → dispatch.
- [x] 1.2 Declare `inputs`: `anthropic_api_key`, `claude_code_oauth_token`, `github_token`, `app_id`, `private_key`, `broker_url`, `broker_audience`.
- [x] 1.3 Forward config from ambient env in the dispatch step: `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_CUSTOM_HEADERS` — each `${{ env.<NAME> }}`.
- [x] 1.4 Relocate the OIDC-broker mint, legacy App-secret mint, and `github_token` fallback into the composite, preserving the broker → legacy → fallback priority and existing `if:` gating.

## 2. Reusable workflow wrapper

- [x] 2.1 Refactor `.github/workflows/openspec-flow.yml` to `uses: ./` the composite action, passing resolved credential/identity inputs.
- [x] 2.2 Keep `on: workflow_call`, job `permissions` (contents/PR/issues write + `id-token: write`), and runner in the wrapper.
- [x] 2.3 Wrapper checks out openspec-flow at `github.job_workflow_sha` so `./` runs the pinned code version; token priority and dispatch env preserved.
- [x] 2.4 Declare optional `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` workflow secrets, forward both to the composite, and emit both names in generated shims.

## 3. Agent credential guard

- [x] 3.1 `src/agent/run.ts`: extract `assertAnthropicCredentials`; fail only when both `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are absent; error names both.
- [x] 3.2 `src/agent/run.test.ts`: passes with only `ANTHROPIC_AUTH_TOKEN`; passes with only `ANTHROPIC_API_KEY`; throws naming both when absent.
- [x] 3.3 Accept `CLAUDE_CODE_OAUTH_TOKEN` in the runtime guard and cover the OAuth-only and no-credential cases.

## 4. Installer advisory (cosmetic)

- [x] 4.1 `src/install/detect.ts`: treat the credential as present when `ANTHROPIC_API_KEY` **or** `CLAUDE_CODE_OAUTH_TOKEN` is a repo secret.
- [x] 4.2 `src/install/index.ts`: advisory copy mentions both credential options.

## 5. Documentation

- [x] 5.1 `docs/advanced-configuration.md`: the two consumption modes; composite-direct worked example with a corporate LLM gateway (`env: ANTHROPIC_BASE_URL` + bearer token).
- [x] 5.2 States explicitly that editing the shim's job `env:` does NOT configure the agent; advanced config requires composite-direct.
- [x] 5.3 Cross-linked from the composite action header comment.

## 6. Verification (runtime — during ark-side testing)

- [ ] 6.1 Drop-in path: existing shim still dispatches with default Anthropic endpoint (regression).
- [ ] 6.2 Composite-direct path: a job setting `env: ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` routes agent traffic through the gateway.
- [ ] 6.3 Token identity preserved: composite-direct run with App inputs mints via broker/legacy as configured, not the `github_token` fallback.
