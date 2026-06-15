# openspec-flow Specification Delta

## ADDED Requirements

### Requirement: Production Fly app stays warm to avoid webhook cold-start

The production Fly app `openspec-flow` SHALL be configured with `auto_stop_machines = 'off'` and `min_machines_running >= 1` so that webhook delivery from GitHub is never gated on a Firecracker cold start.

The configuration SHALL live in `fly.prod.toml` at the repository root and SHALL be the file `flyctl deploy` reads when targeting production.

#### Scenario: Prod machine count never drops to zero

- **GIVEN** `fly.prod.toml` is the production deploy config
- **WHEN** `flyctl status -a openspec-flow` is inspected after at least one successful deploy
- **THEN** `min_machines_running` SHALL be at least 1
- **AND** `auto_stop_machines` SHALL be `'off'`

#### Scenario: Webhook arrives with no warm-up delay

- **GIVEN** the prod app has been idle for at least one hour
- **WHEN** GitHub delivers an `issues.labeled` webhook
- **THEN** Probot SHALL respond within 500ms of the webhook arriving at the load balancer
- **AND** no machine-start log line SHALL appear in the time window

### Requirement: Development Fly app auto-stops on idle to minimise cost

The development Fly app `openspec-flow-dev` SHALL be configured with `auto_stop_machines = 'stop'` and `min_machines_running = 0`. The configuration SHALL live in `fly.dev.toml`.

A cold-start of approximately one second on the first webhook after idle is acceptable for the dev app; cost is the dominant constraint, not latency.

#### Scenario: Dev machines suspend when idle

- **GIVEN** no webhook activity for at least 15 minutes
- **WHEN** `flyctl status -a openspec-flow-dev` is inspected
- **THEN** machine state SHALL be `stopped` or `suspended`
- **AND** monthly compute spend on the dev app SHALL stay below $1 for a typical solo-developer usage pattern

### Requirement: Deploy configurations are file-scoped, not flag-scoped

The repository SHALL maintain two distinct deploy configuration files at the root:

- `fly.dev.toml` for the development app
- `fly.prod.toml` for the production app

All `flyctl deploy` invocations (CI or manual) SHALL pass `--config <file>` explicitly. The repository SHALL NOT maintain a single shared `fly.toml` whose differences are expressed only via `-a <app>` and per-app secrets, because the dev/prod posture differs (auto-stop, broker URL) in ways that are clearer as separate files than as conditional overrides.

#### Scenario: Manual deploy requires explicit config

- **GIVEN** an operator runs `flyctl deploy --remote-only` without `--config`
- **WHEN** flyctl resolves the config file
- **THEN** flyctl SHALL exit with an error (no default `fly.toml` exists)
- **AND** the operator SHALL be required to pass `--config fly.dev.toml` or `--config fly.prod.toml`
