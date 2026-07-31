# Tasks: spec-oauth-token-support

## 1. Spec deltas

- [x] 1.1 `specs/install/spec.md` — MODIFIED probe requirement + four scenarios (OAuth present, API-key present, neither set, probe skipped).
- [x] 1.2 `specs/app-install-init/spec.md` — MODIFIED PR-body requirement + scenario naming the OAuth command with API-key alternative.
- [x] 1.3 `specs/agent-runtime/spec.md` — MODIFIED startup requirement listing all three accepted credentials + four scenarios.

## 2. Docs cleanup

- [x] 2.1 `docs/app-setup.md` — `.env` template shows `CLAUDE_CODE_OAUTH_TOKEN=` first (recommended) with `ANTHROPIC_API_KEY=` below as alternative.
- [x] 2.2 `docs/developer-guide.md` — first paragraph mentions either credential.
- [x] 2.3 `.env.example` — adds `CLAUDE_CODE_OAUTH_TOKEN=` above `ANTHROPIC_API_KEY=`, both blank, with a comment naming OAuth as recommended.

## 3. Validation

- [ ] 3.1 `openspec validate --changes spec-oauth-token-support` passes.
- [ ] 3.2 `npm test` passes (should be a no-op — no runtime changes).
- [ ] 3.3 Live smoke test on git-workforest with OAuth-only auth confirms the runtime works (running in parallel with this PR — result reported in the PR body once known).

## 4. PR

- [ ] 4.1 Commit + push branch `feat/spec-oauth-token-support`.
- [ ] 4.2 Open PR. Body notes live smoke test in progress.
- [ ] 4.3 Archive change via `openspec archive spec-oauth-token-support --yes` as part of the impl PR (or a follow-up if scope grows).
