## ADDED Requirements

### Requirement: Sticky status comment carries an HTML marker

Every status comment posted by the dispatcher SHALL begin with the literal
line `<!-- openspec-flow:status -->` as the first line of the body. This
marker SHALL be used to locate prior status comments on subsequent
intents on the same issue or PR.

The marker SHALL be distinct from the existing
`<!-- openspec-flow-summary -->` marker used by workflow-mode summary
comments, so prune steps that target one marker do not affect the other.

#### Scenario: Marker is the first line
- **WHEN** the dispatcher posts or updates a status comment
- **THEN** the comment body starts with `<!-- openspec-flow:status -->`
  followed by a newline

#### Scenario: Marker is distinct from summary marker
- **WHEN** a workflow-mode prune step deletes comments containing
  `<!-- openspec-flow-summary -->`
- **THEN** the dispatcher's status comments (which contain only
  `<!-- openspec-flow:status -->`) MUST NOT be deleted

### Requirement: Dispatcher reposts the status comment on every actionable intent

For every actionable or visible-noop intent, the dispatcher SHALL ensure
the freshest status comment is the most recent comment in the issue or
PR's timeline. This is the "bring to top" rule: an in-place edit of a
prior sticky is forbidden across runs because the edited comment would
remain at its original position, possibly buried under subsequent
discussion.

The dispatcher SHALL implement this by:

1. Scanning the issue's first 100 comments and collecting every comment
   whose body contains `<!-- openspec-flow:status -->`. Call this set
   `priors`.
2. POSTing a new comment carrying the working (or terminal, for visible
   noops) body via `octokit.issues.createComment({ issue_number, body })`.
   Call the returned id `newStickyId`.
3. For every entry in `priors`, calling
   `octokit.issues.deleteComment({ comment_id })`. The new sticky's own
   id MUST be excluded from this loop (belt-and-braces; only relevant if
   the new POST happened to land within the paginated window before this
   step ran).

The POST SHALL happen before the DELETE so there is no window in which
the issue carries no status comment. A failed DELETE SHALL log a warning
and SHALL NOT abort the flow; the next iteration's lookup will collect
and delete any straggler stickies.

The dispatcher SHALL NOT use `octokit.issues.updateComment` to refresh
the sticky across runs — repost is the only mode at the dispatcher
boundary.

#### Scenario: First actionable intent on a fresh issue
- **GIVEN** issue #N has no comment containing the status marker
- **WHEN** the dispatcher handles an actionable intent on issue #N
- **THEN** the dispatcher POSTs a new comment whose body begins with
  the status marker AND does not call `deleteComment` (no priors)

#### Scenario: Second iteration reposts and deletes prior
- **GIVEN** issue #N already has one comment carrying the status
  marker (created by an earlier run) and several intervening
  discussion comments after it
- **WHEN** the user re-applies `openspec:go` and the dispatcher
  handles the new intent
- **THEN** the dispatcher POSTs a fresh comment carrying the status
  marker AND then calls `deleteComment` against the prior sticky's id
- **AND** the freshest sticky's `created_at` is later than every other
  comment on the issue (i.e. it is the bottom of the thread)

#### Scenario: Multiple stragglers are cleaned up
- **GIVEN** a previous repost's DELETE failed, leaving two comments
  carrying the status marker
- **WHEN** the dispatcher handles the next actionable intent
- **THEN** the dispatcher POSTs one new sticky AND calls
  `deleteComment` on both prior stickies, leaving exactly one status
  comment on the issue

#### Scenario: DELETE failure does not abort the flow
- **GIVEN** the prior sticky DELETE returns a non-2xx response
- **WHEN** the dispatcher handles the new intent
- **THEN** the dispatcher logs a warning AND proceeds to invoke the
  handler as normal (the new sticky is already posted)

### Requirement: Handler patches the sticky in place within a single run

The handler invoked by a given dispatcher run SHALL patch the working sticky in place via `octokit.issues.updateComment` to transition it to its terminal body (handler success or failure outcome), and SHALL NOT post a new comment for the terminal state.

The dispatcher SHALL pass an `updateStatus(body: string)` callback to
the handler. This callback SHALL wrap
`octokit.issues.updateComment({ comment_id, body })` with the
`comment_id` of the sticky posted by step 2 of the repost requirement
above closed over.

The patch-in-place rule applies *only* within a single dispatcher run;
the next `openspec:go` event triggers a fresh repost at the dispatcher
boundary.

#### Scenario: Handler success patches the working sticky
- **GIVEN** the dispatcher has posted the working sticky for a
  `create-spec` intent
- **WHEN** `handleCreateSpec` returns successfully after opening spec
  PR #M and calls `updateStatus("openspec opened spec PR: #M")`
- **THEN** the dispatcher's just-posted sticky body is replaced via
  `updateComment` with the terminal text
- **AND** no new comment is posted for the terminal state
- **AND** the sticky's position in the thread does not change

#### Scenario: Handler failure patches the working sticky
- **GIVEN** the dispatcher has posted the working sticky and invoked
  the handler
- **WHEN** the handler throws
- **THEN** the dispatcher catches the error AND calls `updateStatus`
  with a terminal failure body that names the failure (and links the
  workflow run URL when available)
- **AND** no new comment is posted

### Requirement: Working state shows liveness, terminal state shows outcome

The sticky comment SHALL transition through two body shapes per run:

1. **Working state** — set by the dispatcher immediately after the eyes
   reaction, before invoking the handler. The body SHALL include:
   - the status marker on the first line,
   - a liveness indicator (an `<img>` tag referencing an animated asset
     hosted at `${PUBLIC_BASE_URL}/working.svg`, OR the literal text
     `⏳ working…` when `PUBLIC_BASE_URL` is unset),
   - the human-readable intent summary returned by `describe(intent)`.

2. **Terminal state** — set by the handler on success (e.g. "openspec
   opened spec PR: #M") or by the dispatcher's error handler on failure
   (e.g. "openspec failed — see <run-url>"). The terminal body SHALL
   NOT include the liveness indicator.

Visible-noop intents (e.g. `openspec:go` on a closed issue) SHALL skip
the working state. The dispatcher SHALL repost a terminal-only sticky
containing the noop reason.

#### Scenario: Working sticky posted before handler runs
- **WHEN** the dispatcher routes a `create-spec` intent
- **THEN** the dispatcher posts a sticky carrying the working body
  (with the liveness indicator) before awaiting `handleCreateSpec(...)`

#### Scenario: Visible noop reposts a terminal-only sticky
- **WHEN** the classifier returns a visible noop (e.g. `openspec:go`
  on a closed issue)
- **THEN** the dispatcher reposts (POST new + DELETE priors) a
  terminal sticky containing the noop reason and does NOT post a
  working state first

### Requirement: Status repost failures do not block handlers

The dispatcher SHALL treat sticky-comment API failures as best-effort:
a non-2xx response from `listComments`, `createComment`,
`updateComment`, or `deleteComment` SHALL be logged as a warning and
SHALL NOT prevent the handler (`handleCreateSpec`, `handleCreateImpl`)
from running. The status comment is UX polish; the handler's work is
the primary deliverable.

#### Scenario: List-comments fails during prior lookup
- **WHEN** `octokit.issues.listComments` returns a non-2xx response
  during the repost lookup
- **THEN** the dispatcher logs a warning AND proceeds to POST a new
  sticky AND invokes the handler as normal

#### Scenario: Create-comment fails
- **WHEN** `octokit.issues.createComment` returns a non-2xx response
- **THEN** the dispatcher logs a warning, skips the subsequent
  DELETE pass (there is no new sticky to keep), AND proceeds to
  invoke the handler as normal

#### Scenario: Update-comment fails during terminal transition
- **WHEN** `octokit.issues.updateComment` returns a non-2xx response
  (e.g. the just-posted sticky was deleted by a concurrent repost)
- **THEN** the dispatcher logs a warning AND does not re-throw

### Requirement: Liveness indicator asset is served from the Probot

The Probot SHALL serve a working-indicator asset at the static path
`/working.svg` relative to its `PUBLIC_BASE_URL`. The asset SHALL be
an animated image (SVG or GIF) under 16 KB, and SHALL render inline
in GitHub-rendered Markdown via an `<img>` tag.

When `PUBLIC_BASE_URL` is unset (e.g. local development without a
public URL), the working body SHALL substitute the literal text
`⏳ working…` for the `<img>` tag so the sticky remains informative.

#### Scenario: Indicator asset reachable
- **WHEN** a GET request is made to `${PUBLIC_BASE_URL}/working.svg`
- **THEN** the server returns the asset with a 2xx status and an
  image content type

#### Scenario: PUBLIC_BASE_URL unset
- **GIVEN** the environment variable `PUBLIC_BASE_URL` is unset
- **WHEN** the dispatcher composes the working body
- **THEN** the body contains the text `⏳ working…` and no `<img>` tag
