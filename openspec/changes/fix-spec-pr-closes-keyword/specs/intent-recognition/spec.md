## MODIFIED Requirements

### Requirement: Classify merged spec PR as create-impl

The classifier SHALL return
`{ kind: "create-impl", specPrNumber, issueNumber }` for a
`pull_request.closed` event where `merged === true` and the PR carries
`openspec:spec`. The issue number SHALL be extracted from the first
matching `closes|fixes|resolves|refs|references|relates to #N`
reference in the PR body (case-insensitive); absent that, it SHALL be
`null`. Both the auto-close family (`closes|fixes|resolves`) and the
non-closing reference family (`refs|references|relates to`) MUST be
accepted so spec PRs — which now use `Refs #N` to avoid prematurely
closing the originating issue — still resolve to the correct issue.

#### Scenario: Spec PR merges with Refs reference
- **WHEN** a PR labelled `openspec:spec` merges into the default branch
  and the PR body contains `Refs #42`
- **THEN** the classifier returns intent `create-impl` with the spec
  PR number and `issueNumber: 42`

#### Scenario: Spec PR merges with Closes reference (legacy / in-flight)
- **WHEN** a PR labelled `openspec:spec` merges into the default branch
  and the PR body contains `Closes #42`
- **THEN** the classifier returns intent `create-impl` with the spec
  PR number and `issueNumber: 42`

#### Scenario: Spec PR merges with no recognised reference
- **WHEN** a PR labelled `openspec:spec` merges and the body contains
  no `closes|fixes|resolves|refs|references|relates to #N` token
- **THEN** the classifier returns intent `create-impl` with the spec
  PR number and `issueNumber: null`
