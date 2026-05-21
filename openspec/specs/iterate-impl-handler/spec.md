# iterate-impl-handler Specification

## Purpose
TBD - created by archiving change dispatcher-handler-registry. Update Purpose after archive.
## Requirements
### Requirement: Iterate-impl handler exists

The package SHALL export `handleIterateImpl` from `src/handlers/iterate-impl/index.ts`. The handler SHALL accept the standard `HandlerCtx` plus an `implPrNumber: number` parameter and SHALL return a `Promise<unknown>`.

#### Scenario: Handler is wired in the registry

- **WHEN** the project builds
- **THEN** the registry entry for `iterate-impl` is the function exported from `src/handlers/iterate-impl/index.ts`

### Requirement: Feedback surfaces read

The handler SHALL read the following surfaces and pass them to the agent as context:

- the impl PR body, top-level issue comments, inline review comments, and review submissions
- the originating issue (body + comments) resolved from the PR-body metadata HTML comment
- the contents of the impl branch at HEAD

The handler SHALL ignore comments authored by `openspec-flow[bot]` and `openspec-flow-dev[bot]` and any other `*[bot]` author whose login matches the configured bot identity.

#### Scenario: Bot comments ignored

- **WHEN** the handler runs against a PR with mixed user + bot comments
- **THEN** the agent prompt's "feedback to address" section contains only the user-authored comments

#### Scenario: Issue resolved from metadata

- **WHEN** the impl PR body contains `<!-- openspec-flow:auto-maintained ... issue: <N> -->`
- **THEN** the handler reads issue `<N>` and includes its body + comments in the prompt context

### Requirement: Mutation scope

The handler SHALL allow the agent to modify files under `src/`, `tests/`, `docs/`, `README.md`, and `public/`. The handler SHALL forbid modifications to `openspec/changes/`, `openspec/specs/`, and `.github/workflows/openspec-flow.yml`.

#### Scenario: Spec mutation refused

- **WHEN** the agent attempts to write a file under `openspec/changes/` or `openspec/specs/` during iterate-impl
- **THEN** the handler's pre-commit verify step fails with a message indicating spec mutations require iterate-spec on the spec PR

### Requirement: Sticky status comment milestones

The handler SHALL update the sticky status comment passed via `ctx.statusCommentId` at the following milestones: reading context, agent finished, push complete, terminal state. The handler SHALL never create a new status comment of its own.

#### Scenario: Reading context milestone

- **WHEN** the handler begins gathering PR + issue context
- **THEN** the sticky status comment body becomes `![working](...) reading context for PR #<N>…`

#### Scenario: Agent finished milestone

- **WHEN** the agent subprocess returns successfully
- **THEN** the sticky status comment body becomes `![working](...) agent finished, pushing branch…`

#### Scenario: Push complete milestone

- **WHEN** the impl branch has been pushed
- **THEN** the sticky status comment body becomes `✅ impl updated by openspec-flow`

#### Scenario: Terminal failure

- **WHEN** any step throws
- **THEN** the sticky status comment body becomes `❌ openspec-flow failed: <error>. See dev logs for trace.`
- **AND** the error is re-thrown to the dispatcher's catch block

### Requirement: Commit shape

The handler SHALL commit any agent mutations on the impl branch with a Conventional-Commits message describing the iteration scope. The handler SHALL NOT push — pushing is the harness's responsibility.

#### Scenario: Conventional commit message

- **WHEN** the agent has produced mutations and the verify step passes
- **THEN** exactly one new commit exists on the impl branch
- **AND** the commit subject matches `^(feat|fix|chore|docs|refactor|test|ci|build|perf):`

