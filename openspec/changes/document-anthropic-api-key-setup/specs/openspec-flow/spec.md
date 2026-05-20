## ADDED Requirements

### Requirement: Shim-mode install docs explain Anthropic API key configuration

The repository SHALL ship operator-facing documentation that, for the
shim install mode (Mode A — reusable-workflow shim file at
`.github/workflows/openspec-flow.yml` in the target repo), explains end
to end how to configure the Anthropic API key the agent uses.

The canonical instructions SHALL live in `README.md` under a heading
named "Configure the Anthropic API key" (or equivalent) within the
Install section. The docs SHALL state:

1. Where to obtain an Anthropic API key (`console.anthropic.com`).
2. The exact GitHub UI path to add it as a repo secret:
   Settings → Secrets and variables → Actions → New repository secret.
3. The required secret name: `ANTHROPIC_API_KEY`.
4. That the shim forwards the secret into the reusable workflow via
   the `secrets:` block, and that the value on the right of
   `${{ secrets.ANTHROPIC_API_KEY }}` is the repo-secret name (so the
   names must match).
5. The documented alternative path:
   `CLAUDE_CODE_OAUTH_TOKEN` may be set instead of (or in addition to)
   `ANTHROPIC_API_KEY`, and the workflow accepts either.
6. A manual verification step (re-trigger a labelled issue and check
   the agent step log) that lets the operator confirm the secret is
   wired before reporting that the agent does not run.

`docs/architecture.md` SHALL include a short "Configuring secrets"
note under "Mode A — Action install" that names the secret and links
to the README section by its heading slug, rather than duplicating the
instructions.

`.env.example` SHALL include a comment on the `ANTHROPIC_API_KEY` line
stating that this file is for local Probot/App-mode development and
that shim-mode installs configure the same secret via repo Actions
secrets, with a pointer to the README section.

#### Scenario: README documents where to add the secret

- **WHEN** an operator reads `README.md` to install openspec-flow in
  shim mode
- **THEN** the README contains a section that names
  `ANTHROPIC_API_KEY` as the required secret, gives the GitHub UI
  path (Settings → Secrets and variables → Actions), and identifies
  `console.anthropic.com` as the source of the key

#### Scenario: README documents the OAuth alternative

- **WHEN** an operator already has a `CLAUDE_CODE_OAUTH_TOKEN` and
  reads the README install section
- **THEN** the README states that `CLAUDE_CODE_OAUTH_TOKEN` is an
  accepted alternative to `ANTHROPIC_API_KEY` and that either secret
  satisfies the workflow's authentication requirement

#### Scenario: README explains the shim secret-forwarding contract

- **WHEN** an operator reads the README install snippet
- **THEN** the README explains that the secret name inside
  `${{ secrets.ANTHROPIC_API_KEY }}` refers to the repo-level Actions
  secret and must match the name the operator created in the GitHub
  UI

#### Scenario: README includes a manual verification step

- **WHEN** an operator has added the secret and re-triggered a
  labelled issue
- **THEN** the README tells them which log line (e.g. an
  authentication / 401 failure in the agent step) indicates the
  secret is missing or wrong, so they can confirm the configuration
  before filing a bug

#### Scenario: Architecture doc links to the README section

- **WHEN** a developer reads `docs/architecture.md` under
  "Mode A — Action install"
- **THEN** that section contains a one-paragraph "Configuring
  secrets" note that names `ANTHROPIC_API_KEY` and links to the
  README section by its heading slug, rather than duplicating the
  step-by-step instructions

#### Scenario: .env.example disambiguates from shim mode

- **WHEN** a developer reads `.env.example`
- **THEN** the `ANTHROPIC_API_KEY` line carries a comment stating
  that `.env` is for local Probot/App-mode development and that
  shim-mode (GitHub Actions) installs configure the same secret via
  repo Actions secrets, with a pointer to the README section
