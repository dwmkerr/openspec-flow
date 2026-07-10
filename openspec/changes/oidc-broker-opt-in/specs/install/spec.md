# install Specification Delta

## MODIFIED Requirements

### Requirement: The generated shim is version-pinned and identity-clear

`install` SHALL pin the generated shim's `uses:` ref to the release version (`@v<package-version>`), not `@main`. When a broker URL is provided (`--broker`), the shim SHALL carry it as `with: oidc_broker_url: <url>` (audience as `oidc_broker_audience`). The shim SHALL include a comment stating that it runs as github-actions[bot] by default and how to opt into openspec-flow[bot] identity.

#### Scenario: Installed shim pins the release version

- **GIVEN** `openspec-flow@0.1.5 install` runs in a repo with `openspec/`
- **WHEN** the shim is written
- **THEN** its `uses:` ref is `…/openspec-flow.yml@v0.1.5`
- **AND** it does not pin `@main`

#### Scenario: Broker URL is emitted as oidc_broker_url

- **GIVEN** `install --broker https://broker.example.com`
- **WHEN** the shim is written
- **THEN** it contains `oidc_broker_url: 'https://broker.example.com'`
- **AND** it does not contain the old `broker_url:` key
