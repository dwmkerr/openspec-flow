# iterate-spec-handler Specification

## ADDED Requirements

### Requirement: iterate-spec SHALL update the status comment at lifecycle milestones instead of posting new comments

When called with `statusCommentId` and `statusTargetNumber`, the iterate-spec handler SHALL update the existing status comment at lifecycle milestones, SHALL set the terminal state to `✅ spec updated by openspec-flow` on success or `❌ openspec-flow failed: <error>. See dev logs.` on failure, and SHALL NOT create a separate `spec updated by openspec-flow` or failure comment.

#### Scenario: Successful iterate updates the status comment on the spec PR
- **GIVEN** the dispatcher passed `statusCommentId = 300` (on the spec PR) when invoking iterate-spec
- **WHEN** the handler finishes pushing the iterated branch
- **THEN** comment 300 ends with `✅ spec updated by openspec-flow`
