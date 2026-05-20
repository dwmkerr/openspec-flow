# openspec-flow Specification

## ADDED Requirements

### Requirement: The create-spec beat opens a real spec PR

The bot SHALL open a pull request labelled `openspec:spec` on branch `chore/<n>-<slug>` with a body containing the auto-maintained metadata block linking back to the issue, and SHALL then comment on the originating issue with the spec PR number, whenever a user adds `openspec:go` to an open issue and the agent runs to completion.

#### Scenario: Happy-path create-spec
- **GIVEN** an open issue #N with the `openspec:go` label freshly
  applied
- **WHEN** the bot processes the event
- **THEN** a spec PR is opened against `main` carrying the
  `openspec:spec` label and the issue receives a comment
  `spec PR opened: #M`
