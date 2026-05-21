# create-impl-handler Specification

## ADDED Requirements

### Requirement: create-impl SHALL update the status comment at lifecycle milestones instead of posting new comments

When called with `statusCommentId` and `statusTargetNumber`, the create-impl handler SHALL update the existing status comment at lifecycle milestones, SHALL set the terminal state to `✅ impl PR opened: #M` on success or `❌ openspec-flow failed: <error>. See dev logs.` on failure, and SHALL NOT create a separate `impl PR opened` or failure comment.

#### Scenario: Sequential mode updates the status comment on the originating issue
- **GIVEN** the dispatcher passed `statusCommentId = 200` (on the originating issue) when invoking create-impl after a spec PR merge
- **WHEN** the impl PR opens as #M
- **THEN** comment 200 ends with `✅ impl PR opened: #M`
