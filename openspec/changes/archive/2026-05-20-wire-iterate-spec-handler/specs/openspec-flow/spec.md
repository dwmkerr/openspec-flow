# openspec-flow Specification

## ADDED Requirements

### Requirement: Reviewers can iterate a spec PR by re-applying openspec:go

The bot SHALL update the spec PR in place — by force-pushing an iterated commit to the existing `chore/<n>-<slug>` branch and posting `spec updated by openspec-flow` on the PR — whenever a user adds `openspec:go` to an open PR labelled `openspec:spec`.

#### Scenario: Reviewer iterates a spec PR
- **GIVEN** an open spec PR #27 labelled `openspec:spec`
- **WHEN** a reviewer adds `openspec:go` after leaving review comments
- **THEN** the bot rewrites the spec on the existing branch and comments `spec updated by openspec-flow` on PR #27
