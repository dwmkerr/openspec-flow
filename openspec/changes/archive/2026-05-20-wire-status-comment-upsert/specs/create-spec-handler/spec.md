# create-spec-handler Specification

## ADDED Requirements

### Requirement: Handler SHALL update the status comment at lifecycle milestones instead of posting new comments

When called with `statusCommentId` and `statusTargetNumber`, the handler SHALL update the existing status comment at three milestones (agent-starting, agent-finished, push-complete) and SHALL post the terminal state (`✅ spec PR opened: #M`) by updating the same comment rather than creating a new one. On failure the handler SHALL update the comment with `❌ openspec-flow failed: <error>. See dev logs.` and re-throw.

#### Scenario: Successful create-spec updates a single comment four times
- **GIVEN** dispatcher created a status comment with id 123 before invoking the handler
- **WHEN** the handler completes successfully and opens spec PR #M
- **THEN** comment #123 has been PATCHed three times during the run and ends with `✅ spec PR opened: #M`; no new comment was posted on the originating issue
