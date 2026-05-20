## Why

Mode A (shim install) users currently see only "Add three secrets (`ANTHROPIC_API_KEY`, …)" in the README with no guidance on where the key comes from, how to add it to the repo, or what to do if they want to use a Claude subscription instead of API billing. Issue #8 flags that this leaves new users guessing — they paste the workflow file, the agent fails to start, and the only signal is the `run-agent` composite action's `::error::Neither anthropic_api_key nor claude_code_oauth_token was provided.` line buried in the runner log. Documenting the auth setup explicitly removes the most common first-run failure for shim adopters.

## What Changes

- Add a dedicated "Configure Anthropic auth" subsection under the Mode A install instructions in `README.md` covering: provisioning an Anthropic API key, adding it as `ANTHROPIC_API_KEY` repo secret (UI path + `gh secret set` one-liner), the `CLAUDE_CODE_OAUTH_TOKEN` alternative for subscription users, and the "both set → API key wins" precedence warning that mirrors the runtime warning in `run-agent/action.yml`.
- Surface the same content from `docs/app-setup.md` so the App-mode setup page reuses one canonical block instead of drifting.
- Cross-link the shim auth doc from `docs/architecture.md`'s Mode A section so the deep-dive points readers at the install steps.
- No code changes. No new env vars. No behaviour changes in `.github/actions/openspec-flow-run-agent/action.yml` — its existing fail-fast and conflict warning remain the source of truth that the docs describe.

## Capabilities

### New Capabilities
- `shim-install-docs`: User-facing install documentation for Mode A (shim / reusable-workflow install), starting with Anthropic auth configuration. Owns the README and `docs/` content that tells a first-time shim adopter how to wire up secrets so the agent can authenticate.

### Modified Capabilities
<!-- None — no spec-level behaviour changes in code-bearing capabilities. The run-agent composite action's auth contract is unchanged. -->

## Impact

- `README.md` — new "Configure Anthropic auth" subsection under Mode A install.
- `docs/app-setup.md` — same auth block referenced from the App install flow.
- `docs/architecture.md` — Mode A section adds a one-line link to the new auth doc.
- No source code, no CI, no composite-action changes.
- Affects every Mode A adopter on first install; no migration impact for existing installs.
