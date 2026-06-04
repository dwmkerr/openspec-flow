# openspec-flow Specification Delta

## MODIFIED Requirements

### Requirement: App and Action modes share one dispatch core

openspec-flow SHALL run in two modes — the Probot App and the GitHub Action — that share the same `runDispatch` core, such that any change to routing behaviour applies to both. In the Probot App, in-proc dispatch of `issues` and `pull_request` events SHALL be gated by the environment variable `OPENSPEC_FLOW_DISPATCH_MODE`: when its value is `in-process`, the App adapter SHALL call `runDispatch` for these events; for any other value (including unset), the App adapter SHALL no-op these events so the Action adapter — running in the user's repository — is the sole dispatcher. The `installation.created` handler SHALL ignore the flag and always run, because no Action-mode path exists for installation events.

#### Scenario: Both modes produce the same outcome for the same event when in-process is enabled

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE=in-process` is set for the Probot App
- **WHEN** an `openspec:go` label is applied to an issue with no linked spec PR
- **THEN** both the App adapter and the Action adapter classify `create-spec` and open a spec PR through the same handler

#### Scenario: App adapter no-ops issue events in default mode

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE` is unset (or any value other than `in-process`)
- **WHEN** Probot receives an `issues.labeled` webhook for `openspec:go`
- **THEN** the App adapter does not call `runDispatch`
- **AND** the Action adapter (the shim workflow in the user's repo) is responsible for handling the event

#### Scenario: Install bootstrap runs regardless of dispatch mode

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE` is unset
- **WHEN** Probot receives an `installation.created` webhook
- **THEN** the App adapter runs the install-bootstrap handler

## ADDED Requirements

### Requirement: Probot logs the active dispatch mode on boot

The Probot App SHALL log a line of the form `dispatch-mode=<value>` exactly once during startup, where `<value>` is the effective dispatch mode (`in-process` or `action`). The line SHALL be emitted at info level so operators can confirm the active path without enabling debug logging.

#### Scenario: Default mode logged

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE` is unset
- **WHEN** the Probot App starts
- **THEN** the startup log contains the line `dispatch-mode=action`

#### Scenario: In-process mode logged

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE=in-process` is set
- **WHEN** the Probot App starts
- **THEN** the startup log contains the line `dispatch-mode=in-process`
