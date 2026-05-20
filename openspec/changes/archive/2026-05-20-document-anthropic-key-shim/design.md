## Context

The shim (Mode A) is `openspec-flow`'s shipping install path. A user drops `.github/workflows/openspec-flow.yml` into their repo and adds three secrets. The reusable workflow then calls the local composite action `.github/actions/openspec-flow-run-agent/action.yml`, which forwards `secrets.ANTHROPIC_API_KEY` to `anthropics/claude-code-action`. If neither `anthropic_api_key` nor `claude_code_oauth_token` is set the action prints `::error::Neither anthropic_api_key nor claude_code_oauth_token was provided.` and exits non-zero.

The runtime contract is therefore already well-defined; the gap is purely documentary. The current README (lines 50–58) lists `ANTHROPIC_API_KEY` as one of three secrets to add but does not explain:

1. Where the key comes from (Anthropic Console).
2. How to add it as a repo secret (UI navigation + `gh secret set`).
3. That `CLAUDE_CODE_OAUTH_TOKEN` is a valid alternative for users on a Claude subscription rather than API billing.
4. That setting both causes the API key to win (matches the `run-agent` composite warning).

Stakeholders: new Mode A adopters (primary), repo maintainers triaging "the agent isn't running" issues (secondary).

## Goals / Non-Goals

**Goals:**
- Eliminate the "I pasted the workflow, nothing happens" first-run failure by giving Mode A users a single, scannable auth-setup block.
- Keep the documented behaviour in lock-step with the runtime contract enforced by `openspec-flow-run-agent/action.yml` (fail-fast on missing creds, warn on both set).
- Document the OAuth-token alternative so subscription users aren't pushed into API billing unnecessarily.

**Non-Goals:**
- No changes to the agent runtime, the composite action, the reusable workflow, or any environment variable names.
- No new auth mode. Only documenting the two already implemented.
- Not solving Mode B (App install) auth — `docs/app-setup.md` covers that and only gets a cross-reference, not a rewrite.
- Not adding a secret rotation guide, key-scoping guide, or org-secret guide. Out of scope for this change.

## Decisions

**Decision 1: Single canonical block in README, cross-referenced from docs/**
The auth instructions live in `README.md` (because that's where Mode A install lives) and other docs link to it with a relative anchor (`README.md#configure-anthropic-auth`). Alternative considered: put the canonical block in `docs/shim-auth.md` and have README link out. Rejected because README is where adopters land first; making them follow a link to learn how to fill in the secret they just read about adds friction without benefit.

**Decision 2: Document both API key and OAuth token paths side-by-side**
Two sub-blocks under one heading: "Option 1 — Anthropic API key (recommended for CI)" and "Option 2 — Claude Code OAuth token (subscription)". Alternative: API-key-only with a footnote. Rejected because `run-agent/action.yml` already supports both and the README would imply OAuth is unsupported — pushing subscription users to pay twice.

**Decision 3: Mirror the runtime warning verbatim**
The "both set → API key wins" line uses the same wording as the `::warning::` in `run-agent/action.yml:94`. If the warning text changes the docs change in the same PR. This keeps the runtime behaviour as the source of truth and the docs as a faithful surface; the alternative (paraphrasing) creates drift opportunities.

**Decision 4: Include `gh` CLI commands, not just UI clicks**
Each option ships a `gh secret set ANTHROPIC_API_KEY --body "$KEY"` or `gh secret set CLAUDE_CODE_OAUTH_TOKEN --body "$TOKEN"` invocation alongside the Settings → Secrets UI path. Alternative: UI only. Rejected because most maintainers reading the README already have `gh` installed and copy-paste is faster than clicking through five settings panes.

**Decision 5: No screenshots**
Plain text + code blocks. GitHub's secrets UI changes a few times a year; screenshots rot silently. Alternative considered: include screenshots. Rejected on maintenance cost grounds.

## Risks / Trade-offs

- **Risk:** The documented auth block drifts from `run-agent/action.yml` if the action's auth handling changes.
  → Mitigation: Tasks.md explicitly references `action.yml` lines 85–95; reviewers of any future change to those lines must update the README in the same PR. The CLAUDE.md "what must stay in sync" section already enforces this pattern for the label contract.

- **Risk:** Anthropic renames `ANTHROPIC_API_KEY` or the OAuth token env var.
  → Mitigation: Out of our control. The docs use the same env names as the action; if Anthropic renames them the action change is the trigger to update docs.

- **Risk:** Org-policy users can't set repo secrets and need org secrets.
  → Mitigation: Acknowledge with a one-line "Org-secret installs work the same — set `ANTHROPIC_API_KEY` at the org level and ensure the repo is in the allowlist." Don't expand into a full org-secret guide.

- **Trade-off:** Mode A install section gets longer (~30 added lines). Acceptable because it replaces an opaque "Add three secrets" line with an actionable block; new users save more time than maintainers spend scrolling.

## Migration Plan

Pure docs change. Steps:

1. Land the README + docs edits behind the same PR that archives this change.
2. No rollout. README ships the moment the PR merges.
3. No rollback — if the wording is wrong, follow-up PR fixes it.

No code, no CI, no env vars.
