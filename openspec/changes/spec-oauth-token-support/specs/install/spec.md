# install Specification Delta

## MODIFIED Requirements

### Requirement: Reports Claude credential presence and recommends OAuth

`install` SHALL report the presence of a Claude credential — either `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` — as a GitHub Actions secret when `gh` is on `PATH` and the working directory resolves to a GitHub remote. Presence of either credential SHALL satisfy the probe. `install` SHALL NEVER write a secret value, prompt for one, or transmit one. The probe SHALL always run when the prerequisites are met — there is no opt-out flag.

When both secrets are **missing or unknown** (probe skipped), `install` SHALL print copy-pasteable `gh secret set` commands for both credentials, with `CLAUDE_CODE_OAUTH_TOKEN` listed first annotated `# Claude subscription token (recommended)` and `ANTHROPIC_API_KEY` listed second annotated `# or an Anthropic API key`. When either secret is detected as **present**, `install` SHALL omit the command block.

#### Scenario: Reports presence when OAuth token is set

- **WHEN** `install --yes` runs and `gh` is on PATH and a GitHub remote is configured and `CLAUDE_CODE_OAUTH_TOKEN` is set
- **THEN** stdout contains a line indicating a Claude credential is present
- **AND** no `gh secret set` command block is printed

#### Scenario: Reports presence when API key is set

- **WHEN** `install --yes` runs and `gh` is on PATH and a GitHub remote is configured and `ANTHROPIC_API_KEY` is set (with no `CLAUDE_CODE_OAUTH_TOKEN`)
- **THEN** stdout contains a line indicating a Claude credential is present
- **AND** no `gh secret set` command block is printed

#### Scenario: Prints both set commands with OAuth recommended when neither is set

- **WHEN** `install --yes` runs and the probe reports neither credential set
- **THEN** stdout contains the verbatim line `gh secret set CLAUDE_CODE_OAUTH_TOKEN` annotated with `# Claude subscription token (recommended)`
- **AND** stdout contains the verbatim line `gh secret set ANTHROPIC_API_KEY` annotated with `# or an Anthropic API key`
- **AND** no secret value is written or read

#### Scenario: Prints both set commands when probe is skipped

- **WHEN** `install --yes` runs and the secret probe is skipped (no `gh`, no remote, or unauthenticated)
- **THEN** stdout contains both `gh secret set CLAUDE_CODE_OAUTH_TOKEN` and `gh secret set ANTHROPIC_API_KEY` lines with the recommended-vs-alternative annotations
