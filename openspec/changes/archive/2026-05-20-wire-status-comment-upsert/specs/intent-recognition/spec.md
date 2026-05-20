# intent-recognition Specification

## ADDED Requirements

### Requirement: Dispatcher SHALL post a single status comment per classified intent

The dispatcher SHALL replace the old two-comment behaviour (classifier comment + handler-side final comment) with a single sticky status comment per intent. For actionable intents the initial body SHALL acknowledge receipt (`👀 openspec-flow received: <summary>. Starting…`) and the comment id SHALL be passed to the handler for milestone updates. For visible noops the body SHALL be the reason and no handler runs. The stale `_Phase 2 will wire this to the agent…_` line SHALL be removed.

#### Scenario: Actionable intent → receipt comment then handler updates
- **GIVEN** the classifier returns `create-spec`
- **WHEN** the dispatcher runs
- **THEN** the dispatcher creates a comment whose body starts with `👀 openspec-flow received: create specification for issue #N` and passes the comment id to `handleCreateSpec`

#### Scenario: Visible noop → single terminal comment
- **GIVEN** the classifier returns `{ kind: "noop", visible: true, reason: "Issue #N is closed. Reopen first." }`
- **WHEN** the dispatcher runs
- **THEN** the dispatcher creates exactly one comment with that reason as the body, and no handler runs
