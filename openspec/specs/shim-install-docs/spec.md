# shim-install-docs Specification

## Purpose
TBD - created by archiving change document-anthropic-key-shim. Update Purpose after archive.
## Requirements
### Requirement: README Mode A section SHALL include a "Configure Anthropic auth" subsection

The `README.md` Mode A install section SHALL contain a subsection titled "Configure Anthropic auth" (or equivalent kebab-anchorable heading) placed after the workflow file snippet and before the labels-and-issue step. The subsection SHALL document both authentication paths supported by `.github/actions/openspec-flow-run-agent/action.yml`: an Anthropic API key and a Claude Code OAuth token.

#### Scenario: New adopter reads Mode A install
- **WHEN** a user reads the README's Mode A install section top-to-bottom
- **THEN** the user SHALL encounter, between the workflow snippet and the "Open an issue" step, a heading that introduces Anthropic auth setup and lists both `ANTHROPIC_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN` as supported options

#### Scenario: User searches for "ANTHROPIC_API_KEY" in the repo
- **WHEN** a user greps the README for `ANTHROPIC_API_KEY`
- **THEN** at least one match SHALL appear within the "Configure Anthropic auth" subsection (not only in the workflow YAML snippet)

### Requirement: Auth subsection SHALL document API-key setup with both UI and CLI paths

The "Configure Anthropic auth" subsection SHALL describe how to obtain an Anthropic API key from the Anthropic Console and how to add it as a repository secret named `ANTHROPIC_API_KEY` via the GitHub Settings → Secrets and variables → Actions UI path AND via a `gh secret set ANTHROPIC_API_KEY` command.

#### Scenario: User wants the GUI path
- **WHEN** a user reads the API-key option
- **THEN** the doc SHALL name the Settings UI navigation steps that lead to "Repository secrets"

#### Scenario: User wants the CLI path
- **WHEN** a user reads the API-key option
- **THEN** the doc SHALL include a copy-pasteable shell snippet that calls `gh secret set ANTHROPIC_API_KEY` to create the secret

#### Scenario: User wants the key source
- **WHEN** a user reads the API-key option
- **THEN** the doc SHALL link to the Anthropic Console API-keys page (or name it explicitly) so the user knows where the key value comes from

### Requirement: Auth subsection SHALL document the OAuth-token alternative

The subsection SHALL describe the `CLAUDE_CODE_OAUTH_TOKEN` alternative for users on a Claude subscription, including how the token is generated (`claude setup-token`) and how to add it as a repository secret named `CLAUDE_CODE_OAUTH_TOKEN`.

#### Scenario: Subscription user looks for non-API-billing option
- **WHEN** a subscription user reads the auth subsection
- **THEN** the doc SHALL state that `CLAUDE_CODE_OAUTH_TOKEN` is supported as an alternative to `ANTHROPIC_API_KEY` and SHALL reference the `claude setup-token` command that produces the token

#### Scenario: OAuth user sets the secret
- **WHEN** a subscription user follows the OAuth-token path
- **THEN** the doc SHALL show that the secret name is exactly `CLAUDE_CODE_OAUTH_TOKEN` (matching the input consumed by `openspec-flow-run-agent/action.yml`)

### Requirement: Auth subsection SHALL document the both-set precedence

The subsection SHALL warn that if both `ANTHROPIC_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN` are configured, the Claude Agent SDK uses the API key and ignores the OAuth token, matching the runtime `::warning::` emitted by `openspec-flow-run-agent/action.yml`.

#### Scenario: User sets both secrets and reads the docs
- **WHEN** a user has both secrets configured and re-reads the docs
- **THEN** the doc SHALL explain that the API key takes precedence and that the OAuth token will be ignored until the API-key secret is deleted

#### Scenario: Doc wording matches runtime warning
- **WHEN** the runtime composite action's `::warning::` text for both-set is updated in `openspec-flow-run-agent/action.yml`
- **THEN** the docs SHALL be updated in the same change to preserve consistency between user-facing copy and runtime emission

### Requirement: Auth subsection SHALL state the missing-credentials failure mode

The subsection SHALL tell users that omitting both secrets causes the agent step to fail with an `::error::` annotation, matching the fail-fast check in `openspec-flow-run-agent/action.yml` (the action requires at least one of `anthropic_api_key` or `claude_code_oauth_token`).

#### Scenario: User installs the workflow without setting any secret
- **WHEN** the user reads the auth subsection
- **THEN** the doc SHALL state that at least one of `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` MUST be set or the workflow will fail at the agent step

### Requirement: docs/app-setup.md SHALL reference the canonical README auth subsection

`docs/app-setup.md` SHALL reference the README's "Configure Anthropic auth" subsection (by relative link or duplicated block) rather than maintaining a divergent setup description, so App-mode and shim-mode installs see consistent guidance.

#### Scenario: Reader of app-setup looks up secret configuration
- **WHEN** a reader is on `docs/app-setup.md` and reaches the secrets step
- **THEN** the doc SHALL either link to the README anchor for the auth subsection or restate the same content verbatim, with no contradictory instructions

### Requirement: docs/architecture.md Mode A section SHALL link to the auth subsection

`docs/architecture.md`'s "Mode A — Action install" subsection SHALL contain a relative link pointing at the README's "Configure Anthropic auth" anchor, so deep-dive readers can find install steps without grep.

#### Scenario: Architecture-doc reader wants to install
- **WHEN** a reader on `docs/architecture.md` finishes the Mode A description
- **THEN** the doc SHALL contain a link that resolves to the README's "Configure Anthropic auth" subsection

