# Design: spec-oauth-token-support

## Context

Between v0.1.0 and v0.1.8, four separate PRs (#103, #109, #111, #113) wired `CLAUDE_CODE_OAUTH_TOKEN` support through the composite action, App-init handler, install CLI probe, agent runtime, and reusable workflow. The spec deltas that would have accompanied those PRs did not land, so the canonical specs under `openspec/specs/` describe a narrower behaviour than the code delivers. This change closes that gap — no code moves.

## Goals / Non-Goals

**Goals**:
- Spec deltas describe the actual runtime behaviour so a reader can trust `openspec/specs/` as the source of truth for what the App does.
- Onboarding docs recommend the OAuth token first because it's the easier credential to obtain (Claude subscription users get it via `claude setup-token` in one command; API keys require going through the Anthropic console and imply per-token billing).
- Both credentials remain supported. Removing `ANTHROPIC_API_KEY` would break existing installs (including openspec-flow's own dev on Fly).

**Non-Goals**:
- Adding a precedence guard step in the workflow (shellwright-style "set exactly one"). Not doing this unless we hit the empty-string-env-var failure mode in production.
- Deprecating `ANTHROPIC_API_KEY`. Both are equal citizens; user chooses.
- Reworking the App-install PR body template beyond the credential guidance line.

## Decisions

### D1. Recommend OAuth in guidance surfaces, treat both as equal in behaviour

**Decision**: Every surface that mentions credentials (install CLI output, App-init PR body, `.env.example` comment, `docs/app-setup.md` `.env` template) SHALL list `CLAUDE_CODE_OAUTH_TOKEN` first with the tag "recommended" and `ANTHROPIC_API_KEY` second as the alternative. Runtime behaviour SHALL treat presence of either as satisfying the credential requirement.

**Why**:
- OAuth is friction-free for Claude subscribers — one browser flow, no credit-card decisions.
- API key remains valid for users on the API console or gateway setups.
- "Recommended vs alternative" wording gives a clear default without deprecating.

### D2. `agent-runtime` spec includes `ANTHROPIC_AUTH_TOKEN` as a third accepted credential

**Decision**: The `agent-runtime` `runAgent` startup requirement SHALL list all three env vars the code actually checks: `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`.

**Why**:
- `src/agent/run.ts` already checks all three (the third supports Anthropic-compatible gateway bearer tokens).
- Documenting only two in the spec would still be drift.

### D3. `.env.example` shows both as blank, no default value

**Decision**: `.env.example` adds a `CLAUDE_CODE_OAUTH_TOKEN=` line above `ANTHROPIC_API_KEY=`, both blank. A short comment above the pair names OAuth as recommended.

**Why**:
- Placeholder values (e.g. `sk-ant-...`) leak into commits when users forget to strip them.
- Blank values force the reader to actually set what they want.

## Risks

### Risk: Users copy both secrets and hit an unknown Claude SDK precedence bug

Mitigation: docs explicitly say "set one, not both". If we hit the empty-string bug in the wild, adopting the shellwright precedence guard is a one-day follow-up.

### Risk: Spec drift returns as future PRs land unaccompanied

Mitigation: CLAUDE.md already says spec deltas belong with runtime PRs. This change is the retroactive fix; the process rule stands.
