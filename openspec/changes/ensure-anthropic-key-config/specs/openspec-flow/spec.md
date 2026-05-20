## ADDED Requirements

### Requirement: Shim-install docs explain Anthropic credential setup

User-facing documentation for the shim-install path (Mode A) SHALL
explain how to provide the Anthropic credential that the reusable
workflow forwards to the Claude agent. The documentation SHALL cover
both supported credentials — `ANTHROPIC_API_KEY` and the alternative
`CLAUDE_CODE_OAUTH_TOKEN` — and SHALL specify where each one is created
and how to register it as a GitHub Actions secret on the target repo or
organisation.

`README.md` SHALL carry a concise "Anthropic credential" subsection
inside the Mode A install section that names both credentials, links to
the Anthropic console for API key creation, and shows the GitHub UI path
to add an Actions secret. `docs/architecture.md` SHALL carry the deeper
reference, including credential precedence (when both are set) and a
troubleshooting note for the failure mode where neither is set.

When the workflow's accepted credential surface changes (a credential is
added, removed, or renamed), both `README.md` and `docs/architecture.md`
SHALL be updated in the same change.

#### Scenario: README walks a new user through key configuration
- **WHEN** a first-time user reads `README.md` to install Mode A
- **THEN** the README explains, inside the Mode A section, that the
  workflow needs an Anthropic credential, names `ANTHROPIC_API_KEY` as
  the primary option and `CLAUDE_CODE_OAUTH_TOKEN` as the alternative,
  links to `https://console.anthropic.com/settings/keys` for API key
  creation, and tells the user to register the value under
  `Settings → Secrets and variables → Actions → New repository secret`

#### Scenario: Architecture doc records credential precedence and troubleshooting
- **WHEN** a user consults `docs/architecture.md` for Mode A
- **THEN** the document describes which credential takes precedence
  when both secrets are set, and includes a troubleshooting entry
  that names the error a user sees when neither secret is configured
  along with the remediation steps

#### Scenario: Credential surface change forces doc update
- **WHEN** a change modifies the reusable workflow's accepted Anthropic
  credentials (adding, removing, or renaming a credential input)
- **THEN** the same change updates `README.md` and
  `docs/architecture.md` so the documented credential set matches the
  workflow's `secrets:` block
