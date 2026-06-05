# openspec-flow Specification Delta

## MODIFIED Requirements

### Requirement: App and Action modes share one dispatch core

openspec-flow SHALL run in two modes — the Probot App and the GitHub Action — that share the same `runDispatch` core, such that any change to routing behaviour applies to both. In the Probot App, in-proc dispatch of `issues` and `pull_request` events SHALL be gated by the environment variable `OPENSPEC_FLOW_DISPATCH_MODE`: when its value is `in-process`, the App adapter SHALL call `runDispatch` for these events; for any other value (including unset), the App adapter SHALL no-op these events so the Action adapter — running in the user's repository — is the sole dispatcher. The `installation.created` handler SHALL ignore the flag and always run, because no Action-mode path exists for installation events. **Best-effort acknowledgement side effects (specifically the 👀 reaction add/remove via `src/reactions.ts`) are also exempt from the dispatch-mode gate** — the gate scopes dispatch, not acknowledgement. The App adapter MAY call `addEyes` before the gate and `removeEyes` from a separate event handler (`workflow_run.completed`) regardless of the flag value.

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

#### Scenario: Eyes reaction is added regardless of dispatch mode

- **GIVEN** `OPENSPEC_FLOW_DISPATCH_MODE` is unset
- **WHEN** Probot receives an `issues.labeled` webhook adding `openspec:go` to an open issue
- **THEN** the App adapter calls `addEyes` on the issue
- **AND** the App adapter still no-ops the dispatch (the shim handles it)
