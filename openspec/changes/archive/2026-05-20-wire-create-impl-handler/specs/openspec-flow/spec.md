# openspec-flow Specification

## ADDED Requirements

### Requirement: The create-impl beat opens a real impl PR

The bot SHALL open a pull request labelled `openspec:impl` on branch `feat/<n>-<slug>` with a body containing the auto-maintained metadata block linking back to the issue AND the spec PR, whenever a spec PR labelled `openspec:spec` is merged.

#### Scenario: Sequential happy-path
- **GIVEN** an open issue #N tracked by a spec PR labelled `openspec:spec`
- **WHEN** the spec PR is merged to main
- **THEN** an impl PR opens against `main` labelled `openspec:impl`,
  and the originating issue receives a comment `impl PR opened: #M`

### Requirement: Chained mode opens the impl PR alongside the spec PR

When `OPENSPEC_FLOW_CHAINED_MODE=true`, the bot SHALL open the impl PR immediately after opening the spec PR, with the impl PR's `base` set to the spec branch (stacked PR). The impl PR's base SHALL automatically retarget to `main` when the spec PR later merges.

#### Scenario: Chained mode happy-path
- **GIVEN** `OPENSPEC_FLOW_CHAINED_MODE=true` and an issue receives
  `openspec:go`
- **WHEN** the bot finishes opening the spec PR
- **THEN** the bot immediately opens an impl PR with `base:
  chore/<n>-<slug>` and `head: feat/<n>-<slug>` labelled
  `openspec:impl`
