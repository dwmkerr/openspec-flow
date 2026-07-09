# Tasks: composite-action-env-passthrough

## 1. Composite action

- [ ] 1.1 Add root `action.yml` (`using: composite`) with steps: checkout → setup-node → build → install OpenSpec CLI → mint App token → dispatch.
- [ ] 1.2 Declare `inputs`: `anthropic_api_key`, `claude_code_oauth_token`, `app_id`, `private_key`, `broker_url` (App-identity + credentials).
- [ ] 1.3 Forward config from ambient env in the dispatch step: `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_CUSTOM_HEADERS`, `ANTHROPIC_DEFAULT_{SONNET,HAIKU,OPUS}_MODEL` — each `${{ env.<NAME> }}`.
- [ ] 1.4 Relocate the OIDC-broker mint, legacy App-secret mint, and `GITHUB_TOKEN` fallback into the composite, preserving the broker → legacy → `GITHUB_TOKEN` priority and existing `if:` gating.

## 2. Reusable workflow wrapper

- [ ] 2.1 Refactor `.github/workflows/openspec-flow.yml` to `uses: ./` the composite action, passing resolved credential/identity inputs.
- [ ] 2.2 Keep `on: workflow_call`, job `permissions` (contents/PR/issues write + `id-token: write`), and runner in the wrapper.
- [ ] 2.3 Confirm drop-in behavior is byte-for-byte equivalent for consumers using the shim (same token priority, same dispatch env).

## 3. Agent credential guard

- [ ] 3.1 `src/agent/run.ts`: fail only when both `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are absent; update the error message to name both.
- [ ] 3.2 Unit test: passes with only `ANTHROPIC_AUTH_TOKEN` set; passes with only `ANTHROPIC_API_KEY`; throws when both absent.

## 4. Installer advisory (cosmetic)

- [ ] 4.1 `src/install/detect.ts`: treat the credential as present when `ANTHROPIC_API_KEY` **or** `CLAUDE_CODE_OAUTH_TOKEN` is a repo secret.
- [ ] 4.2 `src/install/index.ts`, `src/app-install/index.ts`: update advisory copy to mention both credential options.

## 5. Documentation

- [ ] 5.1 `docs/advanced-configuration.md`: the two consumption modes; composite-direct worked example with a corporate LLM gateway (`env: ANTHROPIC_BASE_URL` + bearer token secret).
- [ ] 5.2 State explicitly that editing the shim's job `env:` does NOT configure the agent (env does not cross `workflow_call`); advanced config requires composite-direct.
- [ ] 5.3 Cross-link from README and the reusable-workflow header comment.

## 6. Verification

- [ ] 6.1 Drop-in path: existing shim still dispatches with default Anthropic endpoint (regression).
- [ ] 6.2 Composite-direct path: a job setting `env: ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` routes agent traffic through the gateway.
- [ ] 6.3 Token identity preserved: composite-direct run with App inputs mints via broker/legacy as configured, not `GITHUB_TOKEN`.
