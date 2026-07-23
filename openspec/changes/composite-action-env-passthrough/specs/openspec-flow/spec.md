# openspec-flow Specification Delta

## MODIFIED Requirements

### Requirement: Reusable workflow delegates the pipeline to the composite action

The reusable workflow SHALL delegate the agent pipeline to the root composite action via a `uses: ./` step, rather than defining the checkout/build/mint/dispatch steps inline. It SHALL continue to own `on: workflow_call`, the job `permissions` block (contents/pull-requests/issues `write` plus `id-token: write`), and the runner.

Drop-in consumers that call the reusable workflow via the shim SHALL observe no behavioral change: the same token-mint priority chain (broker → legacy App secrets → `GITHUB_TOKEN`) applies, and the same dispatch environment is produced. The relocation of the mint steps into the composite action SHALL be transparent to shim consumers.

The reusable workflow SHALL declare both `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` as optional secrets and forward them to the composite action. A generated shim SHALL pass both optional secret names so a repository can standardise on either credential without changing the workflow structure. Exactly one Claude credential is sufficient.

#### Scenario: Shim authenticates with a Claude Code OAuth token

- **GIVEN** a generated shim whose repository defines `CLAUDE_CODE_OAUTH_TOKEN` and not `ANTHROPIC_API_KEY`
- **WHEN** the reusable workflow dispatches the agent
- **THEN** it forwards the OAuth token to the composite action
- **AND** the agent credential guard permits the run

#### Scenario: Shim consumer unaffected by the refactor

- **GIVEN** a target repo using the shim template unchanged
- **WHEN** the reusable workflow runs after the refactor
- **THEN** the agent dispatches with the same token identity and default Anthropic endpoint as before
- **AND** no new inputs or secrets are required of the consumer

#### Scenario: Reusable workflow owns triggers and permissions

- **GIVEN** the reusable workflow delegates to the composite action
- **WHEN** it is invoked via `workflow_call`
- **THEN** it still declares `on: workflow_call`, the job `permissions`, and the runner
- **AND** the composite action provides only the pipeline steps

## ADDED Requirements

### Requirement: Advanced configuration requires composite-direct consumption

Documentation SHALL state that advanced Anthropic configuration (gateway base URL, bearer token, custom headers, model overrides) is available only when a consumer invokes the composite action directly from their own job, where the caller's `env:` is inherited.

Setting `env:` on a shim that calls the reusable workflow SHALL NOT configure the agent, because environment does not cross the `workflow_call` boundary. The documented graduation path is to replace the reusable-workflow shim with a composite-direct job.

#### Scenario: Shim env is inert

- **GIVEN** a shim that calls the reusable workflow and sets `env: ANTHROPIC_BASE_URL` at the job level
- **WHEN** the workflow runs
- **THEN** the agent does not receive `ANTHROPIC_BASE_URL`
- **AND** the documentation directs the consumer to composite-direct consumption for this configuration
