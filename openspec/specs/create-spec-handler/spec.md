# create-spec-handler Specification

## Purpose
TBD - created by archiving change wire-create-spec-handler. Update Purpose after archive.
## Requirements
### Requirement: Handler clones the target repo to an ephemeral workdir

The handler SHALL clone the target repository to
`$OPENSPEC_FLOW_WORKDIR/<issue-number>-<unix-timestamp>` (default
`/tmp/openspec-flow/...`) before invoking the agent and SHALL
remove the workdir on exit unless `OPENSPEC_FLOW_KEEP_WORKDIR=true`.

#### Scenario: Workdir is created per invocation
- **WHEN** the handler runs for an issue
- **THEN** a unique workdir is created under `OPENSPEC_FLOW_WORKDIR`
  and contains a checkout of the target repository's default branch

#### Scenario: Workdir is removed on success
- **GIVEN** `OPENSPEC_FLOW_KEEP_WORKDIR` is unset or `false`
- **WHEN** the handler finishes successfully
- **THEN** the workdir directory is removed

#### Scenario: Workdir is kept on failure when configured
- **GIVEN** `OPENSPEC_FLOW_KEEP_WORKDIR=true`
- **WHEN** the handler fails for any reason
- **THEN** the workdir is left in place for post-mortem inspection

### Requirement: Handler aborts when OpenSpec is not installed in the target repo

The handler SHALL verify that the `openspec` binary is available on
`PATH` and that `.claude/skills/openspec-new-change/` exists inside
the workdir before invoking the agent. If either check fails the
handler SHALL post a visible failure comment on the issue naming
the missing prerequisite and SHALL NOT invoke the agent.

#### Scenario: openspec binary missing
- **WHEN** `openspec --version` is not runnable
- **THEN** the handler posts a failure comment "openspec CLI not
  installed" on the issue and exits without calling the agent

#### Scenario: openspec-new-change skill missing in target repo
- **WHEN** the workdir does not contain
  `.claude/skills/openspec-new-change/`
- **THEN** the handler posts a failure comment pointing the user
  at `openspec init` and exits without calling the agent

### Requirement: Agent fetches issue context itself via the gh CLI

The agent SHALL fetch the issue body and every comment via the
`gh` CLI inside the workdir as its first action; the handler SHALL
NOT pre-fetch and inline the context into the prompt. The handler
SHALL make a GitHub-scoped token available to the agent's Bash
subprocess via `GH_TOKEN` so `gh issue view ... --comments`
succeeds without prompting for auth.

#### Scenario: Agent fetches body + comments before drafting
- **WHEN** the agent starts
- **THEN** its first tool call is `gh issue view <n> -R <repo>
  --comments` (or equivalent) and its reasoning is logged before
  any change is scaffolded

#### Scenario: Bash subprocess inherits a GitHub token
- **WHEN** the handler invokes `runAgent`
- **THEN** the agent's Bash tool runs with `GH_TOKEN` set to a
  GitHub-scoped token sufficient for `gh issue view`

### Requirement: Agent invocation does not include git or gh in its instructions

The handler's prompt SHALL direct the agent to use the
`openspec-new-change` skill to create exactly one OpenSpec change
under `openspec/changes/`. The prompt SHALL NOT instruct the agent
to run any `git` or `gh` commands.

#### Scenario: Prompt scope
- **WHEN** the handler renders the prompt
- **THEN** the rendered prompt contains no instruction to branch,
  commit, push, label, or open a PR

### Requirement: Handler verifies the agent produced at least one change

After the agent returns, the handler SHALL list new directories
under `workdir/openspec/changes/` (excluding `archive/`). If zero
new directories are found, the handler SHALL post a visible failure
comment "agent didn't create any openspec changes" and SHALL NOT
proceed to branch / commit / PR.

#### Scenario: Agent fails to scaffold anything
- **WHEN** the agent returns and `openspec/changes/` is unchanged
- **THEN** the handler posts the failure comment and exits

### Requirement: Handler derives the branch name deterministically in code

The handler SHALL compute the spec PR branch as
`chore/<issue-number>-<kebab-slug>`, where the slug is the
lower-cased issue title with non-alphanumeric runs replaced by
hyphens, leading/trailing hyphens stripped, truncated to 50
characters. The agent SHALL NOT influence the branch name.

#### Scenario: Branch slug derived from title
- **GIVEN** issue #10 with title "Add CSV export — RFC 4180"
- **WHEN** the handler computes the branch name
- **THEN** the branch is `chore/10-add-csv-export-rfc-4180`

### Requirement: Handler commits with a conventional-commit chore prefix

The handler SHALL commit the agent's changes with the message
`chore: <issue-title>` (the literal issue title, untrimmed apart
from leading/trailing whitespace) and SHALL push the branch to
`origin`.

#### Scenario: Commit message format
- **GIVEN** issue #10 titled "Add CSV export"
- **WHEN** the handler commits
- **THEN** the commit message is `chore: Add CSV export`

### Requirement: Handler opens the spec PR via Octokit with the metadata block

The handler SHALL open a pull request via Octokit with: base
`main`, head `chore/<n>-<slug>`, title derived from the issue
title, body ending in the auto-maintained HTML comment metadata
block per `CLAUDE.md`, and the `openspec:spec` label applied. The
handler SHALL NOT shell out to `gh pr create` for this step.

#### Scenario: PR body contains the metadata block
- **WHEN** the handler opens the spec PR
- **THEN** the PR body ends with an HTML comment block containing
  `issue: <n>`, `kind: spec`, and `change: <change-name>`

### Requirement: Handler comments the spec PR URL back on the issue

After opening the PR, the handler SHALL post a comment on the
originating issue of the form `spec PR opened: #<pr-number>`.

#### Scenario: Comment on success
- **GIVEN** the spec PR is opened as #15
- **WHEN** the handler finishes the PR step
- **THEN** the originating issue receives a comment containing
  `#15`

### Requirement: Handler posts a single visible failure comment on any error

Any error inside the handler SHALL surface as exactly one comment
on the originating issue of the form
`❌ openspec-flow couldn't open a spec PR: <error>. See dev logs
for trace.` and the error SHALL be re-thrown so the dispatcher
logs the stack.

#### Scenario: Clone fails
- **GIVEN** the clone step fails with "permission denied"
- **WHEN** the handler catches the error
- **THEN** the issue receives a failure comment containing
  "permission denied"

### Requirement: Spec handler invokes the impl handler when chained mode is enabled

The `create-spec` handler SHALL invoke `handleCreateImpl` with
`mode: "chained"` after a successful spec PR open whenever
`OPENSPEC_FLOW_CHAINED_MODE` is set to `true`. The invocation
SHALL be wrapped in its own try/catch so a chained-mode impl
failure does not roll back the successful spec PR.

#### Scenario: Spec PR opens, chained mode triggers impl
- **GIVEN** `OPENSPEC_FLOW_CHAINED_MODE=true`
- **WHEN** `handleCreateSpec` finishes opening the spec PR
- **THEN** `handleCreateImpl` is invoked with `mode: "chained"`,
  `specPrNumber`, `specBranch`, `changeName`, and `issueNumber`
  already populated

#### Scenario: Chained impl failure does not affect spec PR
- **GIVEN** chained mode triggers `handleCreateImpl`
- **WHEN** the impl handler throws
- **THEN** the spec PR remains open and the failure surfaces as a
  separate visible comment on the originating issue

### Requirement: Handler SHALL update the status comment at lifecycle milestones instead of posting new comments

When called with `statusCommentId` and `statusTargetNumber`, the handler SHALL update the existing status comment at three milestones (agent-starting, agent-finished, push-complete) and SHALL post the terminal state (`✅ spec PR opened: #M`) by updating the same comment rather than creating a new one. On failure the handler SHALL update the comment with `❌ openspec-flow failed: <error>. See dev logs.` and re-throw.

#### Scenario: Successful create-spec updates a single comment four times
- **GIVEN** dispatcher created a status comment with id 123 before invoking the handler
- **WHEN** the handler completes successfully and opens spec PR #M
- **THEN** comment #123 has been PATCHed three times during the run and ends with `✅ spec PR opened: #M`; no new comment was posted on the originating issue

### Requirement: Spec PR body uses a non-auto-closing issue reference

The handler SHALL render the spec PR body so that it references the
originating issue with `Refs #<n>.` and SHALL NOT include any of
GitHub's auto-close keywords (`close[sd]`, `fix(es|ed)`,
`resolve[sd]`) followed by the originating issue number. The
auto-maintained HTML metadata block remains the canonical linkage and
is unchanged.

#### Scenario: Spec PR body contains Refs, not Closes
- **WHEN** the handler renders the spec PR body for issue #42
- **THEN** the body contains the substring `Refs #42.`
- **AND** the body does NOT contain any of `Closes #42`, `Fixes #42`,
  or `Resolves #42` (case-insensitive)

#### Scenario: Merging a spec PR does not auto-close the issue
- **GIVEN** the handler has opened a spec PR for issue #42 with the
  body produced by `buildSpecPrBody`
- **WHEN** that spec PR merges into the default branch
- **THEN** issue #42 remains open (GitHub does not auto-close it
  because the body contains no auto-close keyword for #42)

