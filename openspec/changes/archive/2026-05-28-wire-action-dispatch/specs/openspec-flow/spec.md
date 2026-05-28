## ADDED Requirements

### Requirement: Classify-and-dispatch is the single routing model

openspec-flow SHALL turn every relevant GitHub event into a typed `Intent` via the `classify()` function and route actionable intents through the handler registry. There SHALL be no per-intent branching outside the registry, and no body/comment scanning for intent — the deterministic trigger is the label state per the CLAUDE.md trigger table.

#### Scenario: Event becomes an intent then a registry dispatch

- **WHEN** a subscribed event arrives in either execution mode
- **THEN** it is classified into exactly one `Intent`
- **AND** an actionable intent is routed via the registry to its handler

### Requirement: App and Action modes share one dispatch core

openspec-flow SHALL run in two functionally-equivalent modes — the Probot App and the GitHub Action — and both SHALL drive the same `runDispatch` core. Adding or changing routing behaviour in one mode SHALL change it in both.

#### Scenario: Both modes produce the same outcome for the same event

- **WHEN** an `openspec:go` label is applied to an issue with no linked spec PR
- **THEN** both the App adapter and the Action adapter classify `create-spec` and open a spec PR through the same handler

## REMOVED Requirements

### Requirement: Single workflow file owns the full OpenSpec lifecycle

**Reason**: Described the pre-Probot single-workflow with plan/implement/respond/cleanup jobs and the `openspec:start`/`spec-ready`/`exploring` label scheme. Superseded by the classify→dispatch model with the `openspec:go`/`openspec:spec`/`openspec:impl` contract.
**Migration**: Behaviour is now described by "Classify-and-dispatch is the single routing model" and the per-handler capability specs (`create-spec-handler`, `iterate-spec-handler`, etc.).

### Requirement: No behaviour change from consolidation

**Reason**: A consolidation-era invariant about the old multi-job workflow; no longer meaningful after the Probot rewrite.
**Migration**: None required — the old workflow it referenced is deleted.

### Requirement: Respond job refines artifacts from PR conversation

**Reason**: The "respond" job and its `openspec:start`-on-PR trigger are part of the retired system. Iteration is now handled by the `iterate-spec` and `iterate-impl` handlers, triggered by `openspec:go`.
**Migration**: See the `iterate-spec-handler` and `iterate-impl-handler` capabilities.

### Requirement: openspec:start label removed after respond run

**Reason**: `openspec:start` is not part of the current label contract; the trigger label is `openspec:go`, removed after acting.
**Migration**: See the label contract in CLAUDE.md and "Reviewers can iterate a spec PR by re-applying openspec:go".

### Requirement: Agent summary comments are prunable

**Reason**: Prunable summary comments were a feature of the old `prune-comments` composite action. Replaced by the single sticky status comment per actionable intent.
**Migration**: See the `status-comment` capability.

### Requirement: Agent comments include a re-engagement footer

**Reason**: The re-engagement footer instructed users to apply `openspec:start`, which no longer exists.
**Migration**: Re-engagement is now applying `openspec:go`; the sticky status comment carries state, not a footer.
