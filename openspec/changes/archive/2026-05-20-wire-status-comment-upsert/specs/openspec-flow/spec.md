# openspec-flow Specification

## ADDED Requirements

### Requirement: The user SHALL see one sticky status comment per actionable intent

For every actionable intent the bot SHALL produce a single comment on the originating issue/PR whose body mutates from receipt to working to terminal state. Reviewers SHALL NOT see a thread of separate intent / progress / completion comments.

#### Scenario: One sticky comment after create-spec
- **WHEN** a user adds `openspec:go` to an issue and the create-spec flow completes
- **THEN** the originating issue carries one bot comment whose final body names the opened spec PR (or the failure reason)
