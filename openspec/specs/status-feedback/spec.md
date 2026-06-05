# status-feedback Specification

## Purpose
TBD - created by archiving change issue-breadcrumb-and-run-link. Update Purpose after archive.
## Requirements
### Requirement: Status comments carry a workflow-run link when available

Every sticky status comment body rendered by `src/handlers/shared/status-bodies.ts` SHALL include a trailing `> 🔎 Watch: [run #N](URL)` line when the renderer is invoked from a GitHub Actions runner (i.e. `GITHUB_REPOSITORY` and `GITHUB_RUN_ID` are present in the environment). The line SHALL be omitted when the renderer is invoked from a non-Action context (Probot in-proc, local CLI runs, tests). Body re-renders on every state transition include the (refreshed) link, so the link does not require a separate API write.

#### Scenario: Renderer in Action context includes the run link

- **GIVEN** `GITHUB_REPOSITORY=dwmkerr/livedown` and `GITHUB_RUN_ID=27003368520` are set
- **WHEN** any `statusReceived` / `statusImplementing` / `statusImplPrOpened` / `statusFailure` body is rendered
- **THEN** the body contains the substring `https://github.com/dwmkerr/livedown/actions/runs/27003368520`

#### Scenario: Renderer outside Action context omits the run link

- **GIVEN** `GITHUB_REPOSITORY` is unset
- **WHEN** any status renderer is invoked
- **THEN** the body does not contain a `Watch:` line

### Requirement: Create-impl posts an early breadcrumb on the originating issue

When the `create-impl` intent is dispatched, an issue breadcrumb comment SHALL be upserted on the originating issue (not the spec PR) carrying the current run state. The breadcrumb SHALL be identified by the marker `<!-- openspec-flow:issue-breadcrumb intent=create-impl issue=<N> spec-pr=<M> -->`. Four states are supported:

- `starting` — posted by the Probot adapter pre-gate on `pull_request.closed` merged + `openspec:spec`, no run link (the workflow hasn't started yet).
- `implementing` — upserted by the workflow's `create-impl` handler after resolving the change name, with the run link.
- `opened` — upserted on impl PR creation, with the impl PR number.
- `failed` — upserted on terminal handler failure, with the reason.

The breadcrumb's lifecycle is independent of the sticky status comment, which continues to live on the `targetNumber` (= spec PR for `create-impl`).

#### Scenario: App pre-gate posts the starting breadcrumb

- **GIVEN** the App is installed on a repo, `OPENSPEC_FLOW_DISPATCH_MODE` is unset (defaulting to `action`), and an open spec PR carries `openspec:spec` with a `Refs #42` reference in its body
- **WHEN** the spec PR is merged
- **THEN** the App posts a comment on issue #42 containing the marker `<!-- openspec-flow:issue-breadcrumb intent=create-impl issue=42 spec-pr=<M> -->` and the text "impl run starting"
- **AND** no `Watch:` link is present (the App has no run id)

#### Scenario: Workflow handler upserts the implementing state with run link

- **GIVEN** the early breadcrumb already exists from the App pre-gate
- **WHEN** the workflow's `create-impl` handler reaches the post-resolution point
- **THEN** the same comment is updated in place
- **AND** the body contains the resolved change name and the run-link line

#### Scenario: Terminal opened state replaces in-flight body

- **WHEN** the create-impl handler opens the impl PR
- **THEN** the breadcrumb body becomes `✅ openspec-flow: impl PR opened: #<M>` with the run link

#### Scenario: Terminal failed state replaces in-flight body

- **WHEN** the create-impl handler throws
- **THEN** the breadcrumb body becomes `⚠️ openspec-flow: impl run failed — <reason>` with the run link

### Requirement: Marker-based comment upsert primitive

`src/handlers/shared/comment-upsert.ts` SHALL expose `upsertCommentByMarker(octokit, owner, repo, issueNumber, marker, body, log)`. The function SHALL list comments on the target issue, look for the first whose body contains `marker`, then PATCH the existing comment or POST a new one. The marker SHALL be automatically appended to the body when not already present. List / patch / post failures SHALL be logged at warn level and SHALL return `{ commentId: null, created: false }` rather than throw.

#### Scenario: Creates on first call

- **GIVEN** an issue with no existing comment carrying the marker
- **WHEN** `upsertCommentByMarker(..., marker, "hello")` is called
- **THEN** a new comment is POSTed
- **AND** the comment body contains the marker

#### Scenario: Patches on subsequent call

- **GIVEN** a comment already carries the marker
- **WHEN** `upsertCommentByMarker(..., marker, "updated")` is called
- **THEN** that comment is PATCHed (not duplicated)

#### Scenario: List failure returns null commentId

- **WHEN** the list call rejects with a transient error
- **THEN** the helper returns `{ commentId: null, created: false }` and logs the failure

### Requirement: Authoritative state-machine reference

`docs/state-machine.md` SHALL be the authoritative reference for the mapping of openspec-flow surfaces (label, status comment, reaction, breadcrumb) to actors (Probot App vs shim workflow) and their idempotency mechanisms. CLAUDE.md, the spec files, and code comments SHALL defer to this document when they conflict.

#### Scenario: State-machine doc exists at the canonical path

- **WHEN** a contributor opens `docs/state-machine.md`
- **THEN** the document contains both the lifecycle ASCII diagram and a table mapping surfaces × actors × idempotency

