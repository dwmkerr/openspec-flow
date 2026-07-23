# app-install-init Specification Delta

## MODIFIED Requirements

### Requirement: Init PR body documents the manual secret setup

The PR body opened by `runAppInit` SHALL contain a section that names the three Actions secrets the workflow requires, with the exact `gh secret set` commands (filled in with the target repo) the user must run before the first `openspec:go`:

- `CLAUDE_CODE_OAUTH_TOKEN` (recommended) or `ANTHROPIC_API_KEY` — exactly one Claude credential for the agent.
- `OPENSPEC_FLOW_APP_ID` — App id for bot identity.
- `OPENSPEC_FLOW_PRIVATE_KEY` — App private key for bot identity.

The body SHALL note that `OPENSPEC_FLOW_PRIVATE_KEY` may be set as an organisation-level secret to avoid repeating it per repo, and SHALL link forward to a follow-up issue tracking the OIDC token broker approach that removes the App-secret distribution requirement entirely.

The body SHALL explain the consequence of skipping the App secrets — namely that the workflow falls back to `GITHUB_TOKEN`, which cannot push files under `.github/workflows/*` and attributes commits to `github-actions[bot]` rather than the openspec-flow App.

#### Scenario: PR body names every secret command

- **WHEN** an init PR opens for `owner/repo`
- **THEN** the PR body contains the substring `gh secret set CLAUDE_CODE_OAUTH_TOKEN`
- **AND** the PR body contains the substring `OPENSPEC_FLOW_APP_ID`
- **AND** the PR body contains the substring `OPENSPEC_FLOW_PRIVATE_KEY`
- **AND** the PR body references `owner/repo`

#### Scenario: PR body explains the GITHUB_TOKEN fallback constraint

- **WHEN** an init PR opens
- **THEN** the PR body notes that workflows fall back to `GITHUB_TOKEN` when the App secrets are absent
- **AND** the body notes that `GITHUB_TOKEN` cannot write `.github/workflows/*`

#### Scenario: PR body suggests org-level secret for reuse

- **WHEN** an init PR opens
- **THEN** the PR body mentions the organisation-secret option for `OPENSPEC_FLOW_PRIVATE_KEY`
