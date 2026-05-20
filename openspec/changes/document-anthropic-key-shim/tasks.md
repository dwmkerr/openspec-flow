## 1. README — Configure Anthropic auth subsection

- [ ] 1.1 Add a `### Configure Anthropic auth` heading under `## Install → Mode A — drop in a workflow file`, placed after the workflow YAML snippet and before the "Add the three labels" line.
- [ ] 1.2 Under the heading add a one-paragraph intro stating that the workflow needs Anthropic credentials and that at least one of `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` MUST be set or the agent step fails.
- [ ] 1.3 Add an "Option 1 — Anthropic API key (recommended for CI)" sub-block: name the Anthropic Console as the key source, show the GitHub Settings → Secrets and variables → Actions → "New repository secret" navigation, and include a `gh secret set ANTHROPIC_API_KEY --body "$ANTHROPIC_API_KEY"` snippet.
- [ ] 1.4 Add an "Option 2 — Claude Code OAuth token (subscription)" sub-block: name `claude setup-token` as the token source and include a `gh secret set CLAUDE_CODE_OAUTH_TOKEN --body "$CLAUDE_CODE_OAUTH_TOKEN"` snippet.
- [ ] 1.5 Add a "Both set?" note that mirrors the runtime warning in `.github/actions/openspec-flow-run-agent/action.yml` lines 93–95 — API key wins, OAuth token is ignored until the API-key secret is deleted.
- [ ] 1.6 Add a one-line "Org secrets work the same way — set the secret at the org level and ensure the repo is in the allowlist." note for org-policy users.

## 2. docs/app-setup.md — single source of truth

- [ ] 2.1 Locate the existing `ANTHROPIC_API_KEY=` mention in `docs/app-setup.md` (around line 99) and either replace the surrounding paragraph with a relative link to the new README anchor (`README.md#configure-anthropic-auth`) or restate the same Option 1 / Option 2 / Both-set block verbatim.
- [ ] 2.2 Verify no contradictory instructions remain in `docs/app-setup.md` (e.g. no "only API key supported" wording).

## 3. docs/architecture.md — Mode A cross-link

- [ ] 3.1 In the `### Mode A — Action install (Phase 1, ship first)` section of `docs/architecture.md`, add a one-line "Install steps and secret configuration live in the [README](../README.md#configure-anthropic-auth)." pointer immediately under the YAML snippet on line ~72.

## 4. Verification

- [ ] 4.1 Run `npx markdown-link-check README.md docs/app-setup.md docs/architecture.md` (or open each file in a Markdown previewer) to confirm the new anchor resolves and no existing links broke.
- [ ] 4.2 `grep -n 'ANTHROPIC_API_KEY' README.md docs/app-setup.md docs/architecture.md` and confirm every mention falls inside or references the new auth subsection (no orphaned mentions).
- [ ] 4.3 Diff the README wording against `.github/actions/openspec-flow-run-agent/action.yml` lines 85–95 and confirm the doc statements match the action's error and warning text.
- [ ] 4.4 Run `openspec validate document-anthropic-key-shim` and confirm it passes.
