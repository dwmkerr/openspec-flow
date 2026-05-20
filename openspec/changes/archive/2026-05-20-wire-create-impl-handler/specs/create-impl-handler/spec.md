# create-impl-handler Specification

## ADDED Requirements

### Requirement: Handler clones the target repo to an ephemeral workdir

The handler SHALL clone the target repository to
`$OPENSPEC_FLOW_WORKDIR/impl-<issue-number>-<unix-timestamp>` before
invoking the agent and SHALL remove the workdir on exit unless
`OPENSPEC_FLOW_KEEP_WORKDIR=true`.

#### Scenario: Workdir created per invocation
- **WHEN** the handler runs
- **THEN** a unique workdir is created under `OPENSPEC_FLOW_WORKDIR`
  containing a checkout of the target repository

### Requirement: Sequential mode runs after spec PR merges to main

The dispatcher SHALL invoke `handleCreateImpl` with `mode:
"sequential"` whenever the classifier returns a `create-impl`
intent (i.e. `pull_request.closed` + `merged: true` + PR carries
`openspec:spec`). The handler SHALL clone the repository's default
branch and SHALL open the impl PR with `base: main`.

#### Scenario: Spec PR merges, impl PR opens on main
- **GIVEN** a merged spec PR labelled `openspec:spec`
- **WHEN** the dispatcher receives the merge event
- **THEN** the handler runs in sequential mode, clones at main,
  and opens an impl PR with `base: main` labelled `openspec:impl`

### Requirement: Chained mode runs immediately after the spec PR opens

The `create-spec` handler SHALL invoke `handleCreateImpl` with `mode: "chained"` directly after the spec PR is opened whenever `OPENSPEC_FLOW_CHAINED_MODE=true`. In chained mode, the impl handler SHALL clone the repository, check out the spec branch, and open the impl PR with `base: <spec-branch>` (stacked PR).

#### Scenario: Chained mode opens stacked impl PR
- **GIVEN** `OPENSPEC_FLOW_CHAINED_MODE=true`
- **WHEN** `handleCreateSpec` opens a spec PR on branch
  `chore/<n>-<slug>`
- **THEN** `handleCreateImpl` runs in chained mode, checks out
  `chore/<n>-<slug>`, and opens an impl PR with
  `base: chore/<n>-<slug>` and `head: feat/<n>-<slug>`

#### Scenario: Chained mode default is off
- **WHEN** `OPENSPEC_FLOW_CHAINED_MODE` is unset or any value other
  than `true`
- **THEN** `handleCreateSpec` returns without invoking
  `handleCreateImpl`

### Requirement: Change name and issue number come from the spec PR metadata in sequential mode

In sequential mode, the handler SHALL fetch the spec PR via Octokit
and parse the auto-maintained HTML comment metadata block in the PR
body to read the `issue` and `change` fields. The handler SHALL
NOT depend on the agent to discover these.

#### Scenario: Metadata block parsed in sequential mode
- **GIVEN** a spec PR whose body contains
  `<!-- openspec-flow:auto-maintained ... issue: 42 ... change: add-csv-export ... -->`
- **WHEN** the handler runs in sequential mode
- **THEN** the handler resolves `issueNumber=42` and
  `changeName=add-csv-export` from the metadata, not from the agent

### Requirement: Handler verifies workdir state changed after the agent runs

After `runAgent` returns, the handler SHALL verify all three:
the change directory under `openspec/changes/<name>/` is GONE
(moved to archive), an archive directory matching
`openspec/changes/archive/*-<name>/` exists, and
`git status --porcelain` is non-empty (code changed). If any check
fails the handler SHALL post a visible failure comment on the
originating issue and SHALL NOT open an impl PR.

#### Scenario: Agent forgot to archive
- **WHEN** the agent returns but `openspec/changes/<name>/` still
  exists
- **THEN** the handler posts a failure comment and aborts

### Requirement: Handler opens the impl PR via Octokit with the impl metadata block

The handler SHALL open a pull request via Octokit with: head
`feat/<n>-<slug>`, base resolved per mode (sequential → `main`,
chained → spec branch), title `feat: <issueTitle>`, body ending
in the impl metadata block containing `issue`, `kind: impl`,
`change`, and `spec-pr`, and the `openspec:impl` label applied.

#### Scenario: Metadata block names the spec PR
- **WHEN** the handler opens the impl PR
- **THEN** the PR body ends with an HTML comment block containing
  `kind: impl`, `change: <change-name>`, `spec-pr: <spec-pr-number>`

### Requirement: Handler comments the impl PR number back on the originating issue

After opening the impl PR, the handler SHALL post a comment on
the originating issue of the form `impl PR opened: #<pr-number>`.

#### Scenario: Comment after successful impl PR creation
- **GIVEN** the impl PR opens as #20 and the originating issue is #11
- **WHEN** the handler finishes
- **THEN** issue #11 receives a comment containing `#20`

### Requirement: Failure surfaces as a comment on the issue and (if it exists) on the impl PR

Any error during the handler SHALL surface as one comment of the
form `❌ openspec-flow couldn't open an impl PR: <error>` on the
originating issue. If the impl PR has already been opened before
the error occurred, the comment SHALL also be posted on the impl
PR. The handler SHALL re-throw so the dispatcher logs the stack.

#### Scenario: Agent error before PR open
- **GIVEN** the agent fails before the impl PR is opened
- **WHEN** the handler catches the error
- **THEN** exactly one failure comment is posted on the originating
  issue

#### Scenario: Error after PR open
- **GIVEN** the impl PR is already opened and a later step fails
- **WHEN** the handler catches the error
- **THEN** failure comments are posted on both the originating
  issue and the impl PR
