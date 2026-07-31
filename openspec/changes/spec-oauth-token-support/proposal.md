# spec-oauth-token-support

## Why

The runtime already accepts `CLAUDE_CODE_OAUTH_TOKEN` end-to-end (shim → reusable workflow → composite action → agent), but three specs and a handful of docs still hardcode `ANTHROPIC_API_KEY` as the sole credential. The gap causes two problems:

1. **Spec drift**: `openspec/specs/install/`, `openspec/specs/app-install-init/`, and `openspec/specs/agent-runtime/` describe behaviour narrower than what the code delivers, so specs are no longer a truthful source. A new contributor reading the specs would not know OAuth is supported.
2. **Onboarding friction**: `docs/app-setup.md`'s `.env` template, `docs/developer-guide.md`'s first paragraph, and `.env.example` still tell new users to set `ANTHROPIC_API_KEY`. Users who prefer the Claude Code subscription (via `claude setup-token`, ~1-year lifetime, no per-token billing surprise) have to piece together the alternative from the shim template.

This change is spec + docs only. No runtime code changes; the behaviour is already shipped in v0.1.8 (via #113 for the reusable workflow / shim and earlier PRs for install probe, App init PR, and agent-runtime).

## What Changes

- **Modified** `openspec/specs/install/spec.md` — probe requirement accepts either secret; guidance recommends OAuth, mentions API key as fallback.
- **Modified** `openspec/specs/app-install-init/spec.md` — PR body requirement mentions both credentials with OAuth as recommended.
- **Modified** `openspec/specs/agent-runtime/spec.md` — startup requirement accepts any of `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, or `ANTHROPIC_AUTH_TOKEN`.
- **Modified** `docs/app-setup.md` — `.env` template shows OAuth line first with API-key line as alternative.
- **Modified** `docs/developer-guide.md` — first paragraph mentions either credential.
- **Modified** `.env.example` — adds `CLAUDE_CODE_OAUTH_TOKEN=` line; both blank by default.
- **Out of scope**: runtime code (already ships). Docker/Fly-secret precedence guards. Removing `ANTHROPIC_API_KEY` support entirely. Adopting shellwright's "set exactly one" precedence step (only worth doing if we hit the empty-string-env-var failure mode in production).

## Capabilities

### Modified Capabilities

- `install`: probe accepts either `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` and treats presence of either as satisfying the credential requirement.
- `app-install-init`: init-PR body documents both credentials, recommends OAuth.
- `agent-runtime`: `runAgent` startup accepts any of `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, or `ANTHROPIC_AUTH_TOKEN`.

## Impact

- Spec deltas: three capability files under `openspec/changes/spec-oauth-token-support/specs/`.
- Docs: `docs/app-setup.md`, `docs/developer-guide.md`, `.env.example`.
- No source-code changes.
- No test changes (runtime tests already assert both-credential support).
- Live test note: git-workforest's OAuth-only smoke test runs in parallel with this PR to confirm the runtime works end-to-end against a real install.
