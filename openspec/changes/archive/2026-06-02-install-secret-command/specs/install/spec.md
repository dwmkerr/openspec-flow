## MODIFIED Requirements

### Requirement: Secret-state reporting

`install` SHALL report the presence of the `ANTHROPIC_API_KEY` GitHub Actions secret when `gh` is on `PATH` and the working directory resolves to a GitHub remote. `install` SHALL NEVER write a secret value, prompt for one, or transmit one. The probe SHALL always run when the prerequisites are met — there is no opt-out flag.

When the secret is **missing or unknown** (probe skipped), `install` SHALL print a copy-pasteable `gh secret set ANTHROPIC_API_KEY` command annotated with a dim `# Setup Anthropic key` comment. When the secret is detected as **present**, `install` SHALL omit the command block.

#### Scenario: Reports presence when gh is available

- **WHEN** `install --yes` runs and `gh` is on PATH and a GitHub remote is configured and `ANTHROPIC_API_KEY` is set
- **THEN** stdout contains a line indicating `ANTHROPIC_API_KEY` is present
- **AND** no `gh secret set` command is printed

#### Scenario: Prints set command when secret is missing

- **WHEN** `install --yes` runs and the probe reports `ANTHROPIC_API_KEY` as missing
- **THEN** stdout contains the verbatim line `gh secret set ANTHROPIC_API_KEY` annotated with `# Setup Anthropic key`
- **AND** no secret value is written or read

#### Scenario: Prints set command when probe is skipped

- **WHEN** `install --yes` runs and the secret probe is skipped (no `gh`, no remote, or unauthenticated)
- **THEN** stdout contains the verbatim line `gh secret set ANTHROPIC_API_KEY` annotated with `# Setup Anthropic key`
