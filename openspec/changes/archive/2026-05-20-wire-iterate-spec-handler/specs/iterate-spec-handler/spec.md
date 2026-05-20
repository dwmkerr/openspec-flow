# iterate-spec-handler Specification

## ADDED Requirements

### Requirement: Handler clones the target repo and checks out the spec branch

The handler SHALL clone the target repository to `$OPENSPEC_FLOW_WORKDIR/iterate-spec-<pr-number>-<unix-timestamp>` and SHALL check out the spec PR's head branch before invoking the agent.

#### Scenario: Workdir reflects current spec branch
- **WHEN** the handler runs on spec PR #27 with head `chore/26-rfc-shim`
- **THEN** the workdir contains a checkout of `chore/26-rfc-shim`

### Requirement: Handler refuses to iterate a closed spec PR

The handler SHALL fetch the spec PR via Octokit and abort with a visible failure comment if the PR `state !== "open"`.

#### Scenario: Closed PR aborts cleanly
- **GIVEN** spec PR #27 is in state `closed`
- **WHEN** the handler runs
- **THEN** the handler posts `❌ openspec-flow couldn't iterate the spec: PR is closed` on PR #27 and exits

### Requirement: Change name and issue number come from the spec PR metadata block

The handler SHALL parse the auto-maintained metadata block in the spec PR body to recover `change` and `issue` fields. If the block is missing or `kind !== "spec"`, the handler SHALL abort with a visible failure comment.

#### Scenario: Metadata block parsed
- **GIVEN** spec PR #27 with body containing `kind: spec`, `change: rfc-shim`, `issue: 26`
- **WHEN** the handler runs
- **THEN** the handler resolves `changeName = rfc-shim` and `issueNumber = 26`

### Requirement: Agent gathers review context itself using gh as needed

The agent's prompt SHALL frame `gh` as the tool for context-gathering, SHALL list the feedback surfaces the agent should consider (originating issue, PR body + comments, inline review comments, reviews, and anything else the reviewer references such as CI runs), SHALL include example `gh` invocations as non-exhaustive guidance, and SHALL instruct the agent to ignore comments authored by `openspec-flow[bot]`. The handler SHALL NOT pre-fetch any of these surfaces.

#### Scenario: Prompt frames gh as the tool with examples
- **WHEN** the handler renders the prompt
- **THEN** the rendered prompt names the surfaces above, includes `gh` example commands, and instructs the agent to ignore `openspec-flow[bot]` comments

### Requirement: Handler verifies the agent changed the workdir and did not archive

After the agent returns, the handler SHALL confirm that `git status --porcelain` is non-empty AND that `openspec/changes/<change-name>/` still exists. If either check fails the handler SHALL post a visible failure comment on the spec PR and SHALL NOT push.

#### Scenario: Agent produced no changes
- **WHEN** the agent returns and the workdir is clean
- **THEN** the handler posts `❌ openspec-flow couldn't iterate the spec: agent produced no changes` and exits

#### Scenario: Agent accidentally archived during iterate
- **WHEN** the agent returns and `openspec/changes/<change-name>/` no longer exists
- **THEN** the handler posts a failure comment naming the missing change directory and exits

### Requirement: Handler force-pushes the spec branch with an explicit lease

The handler SHALL commit with message `chore: iterate spec for #<issue>` and force-push the spec branch to `origin` using `--force-with-lease=<branch>:<remote-sha>` (the lease SHA obtained via `ls-remote`). The handler SHALL NOT create a new branch.

#### Scenario: Push uses explicit lease
- **WHEN** the handler pushes the iterated spec branch
- **THEN** the push command uses the explicit `--force-with-lease=<branch>:<sha>` form so concurrent writers are detected

### Requirement: Handler comments "spec updated" on the spec PR after a successful push

After pushing the iterated branch, the handler SHALL post `spec updated by openspec-flow` on the spec PR.

#### Scenario: Comment posted on success
- **WHEN** the handler finishes successfully on PR #27
- **THEN** PR #27 receives a comment `spec updated by openspec-flow`

### Requirement: Failures surface as a single visible comment on the spec PR

Any error inside the handler SHALL surface as exactly one comment of the form `❌ openspec-flow couldn't iterate the spec: <error>` on the spec PR, and the error SHALL be re-thrown so the dispatcher logs the stack.

#### Scenario: Clone failure
- **GIVEN** the clone step fails
- **WHEN** the handler catches the error
- **THEN** the spec PR receives a failure comment containing the clone error message
