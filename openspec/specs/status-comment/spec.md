# status-comment Specification

## Purpose
TBD - created by archiving change wire-status-comment-upsert. Update Purpose after archive.
## Requirements
### Requirement: A single sticky comment SHALL track the lifecycle of every actionable intent

The dispatcher SHALL create exactly one comment on the originating issue or PR when classifying an actionable intent, and the corresponding handler SHALL update that same comment at lifecycle milestones rather than posting new comments. The shared module SHALL expose `createStatusComment` and `updateStatusComment` helpers that wrap the `/issues/comments` REST endpoints via raw `octokit.request()`.

#### Scenario: One comment per actionable intent
- **GIVEN** a webhook fires an actionable intent (`create-spec`, `create-impl`, or `iterate-spec`)
- **WHEN** the dispatcher and handler complete
- **THEN** exactly one comment exists for that intent on the target issue/PR, and its final body reflects the terminal state (success or failure)

### Requirement: Status comment updates SHALL be best-effort

The `updateStatusComment` helper SHALL catch and log any failure (transient network errors, permission errors, missing comment id) without re-throwing. A degraded comment display SHALL NOT block the handler's substantive work (branch, push, PR open).

#### Scenario: PATCH to comments endpoint returns 5xx
- **WHEN** `updateStatusComment` receives a 5xx response
- **THEN** the helper logs a warning and the handler continues to the next milestone

### Requirement: Visible noops SHALL produce one terminal comment with no upsert

When the classifier returns a visible noop (e.g. `openspec:go` on a closed issue), the dispatcher SHALL create exactly one comment with the noop reason as body, and SHALL NOT update it afterwards.

#### Scenario: openspec:go on a closed issue
- **WHEN** the classifier returns `{ kind: "noop", visible: true, reason: "..." }`
- **THEN** the dispatcher creates one comment carrying the reason and the handler is not invoked

### Requirement: Failure SHALL be a terminal status update, not an additional comment

When a handler catches an error inside its try/catch, the handler SHALL update the status comment with `❌ openspec-flow failed: <error>. See dev logs.` and SHALL NOT post a separate failure comment. The handler SHALL still re-throw so the dispatcher logs the stack.

#### Scenario: Handler agent step throws
- **GIVEN** an actionable intent is in flight with a known `statusCommentId`
- **WHEN** the agent raises during `runAgent`
- **THEN** the handler PATCHes the status comment with the `❌` failure body, then re-throws

### Requirement: Status comment integration SHALL be optional for handlers invoked outside webhook mode

The `statusCommentId` and `statusTargetNumber` opts SHALL be optional on all `Handle*` signatures. When unset (e.g. the CLI invokes a handler locally for debugging), the handler SHALL skip every status-comment write without error.

#### Scenario: CLI invokes a handler without statusCommentId
- **GIVEN** `openspec-flow handle create-spec --issue N --repo X/Y` is run from a shell
- **WHEN** the handler progresses through milestones
- **THEN** no `createStatusComment` or `updateStatusComment` call is made; the handler still runs end-to-end

