## ADDED Requirements

### Requirement: Sticky status comment carries an HTML marker

Every status comment posted by the dispatcher SHALL begin with the literal
line `<!-- openspec-flow:status -->` as the first line of the body. This
marker SHALL be used to locate the prior status comment on subsequent
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

### Requirement: Dispatcher upserts the status comment per actionable intent

For every actionable or visible-noop intent, the dispatcher SHALL ensure
exactly one status comment exists on the target issue or PR. It SHALL
locate the prior status comment by scanning the issue's comments for one
whose body contains the status marker, and:

- **IF** a prior status comment exists, the dispatcher SHALL `PATCH` it
  via `octokit.issues.updateComment({ comment_id, body })` with the new
  body.
- **IF** no prior status comment exists, the dispatcher SHALL `POST` a
  new comment via `octokit.issues.createComment({ issue_number, body })`.

The dispatcher SHALL NOT post a fresh status comment when a prior one is
present — upsert is the only mode.

#### Scenario: First actionable intent on a fresh issue
- **GIVEN** issue #N has no comment containing the status marker
- **WHEN** the dispatcher handles an actionable intent on issue #N
- **THEN** the dispatcher POSTs a new comment whose body begins with
  the status marker

#### Scenario: Subsequent intent re-uses the sticky
- **GIVEN** issue #N already has one comment whose body contains the
  status marker
- **WHEN** the dispatcher handles a second actionable intent on issue #N
- **THEN** the dispatcher PATCHes that same comment via
  `updateComment` and does NOT call `createComment`

#### Scenario: Lookup falls back to post when sticky is absent
- **GIVEN** issue #N's comments do not contain the status marker
- **WHEN** the dispatcher's lookup completes
- **THEN** the dispatcher creates a new sticky rather than failing

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
the working state and write a terminal-only sticky containing the noop
reason.

#### Scenario: Working sticky posted before handler runs
- **WHEN** the dispatcher routes a `create-spec` intent
- **THEN** the dispatcher upserts the sticky to the working body (with
  the liveness indicator) before awaiting `handleCreateSpec(...)`

#### Scenario: Terminal sticky on handler success
- **WHEN** `handleCreateSpec` returns successfully after opening spec
  PR #M
- **THEN** the sticky body is updated to a terminal body that names
  spec PR #M and contains no liveness indicator

#### Scenario: Terminal sticky on handler failure
- **WHEN** `handleCreateSpec` throws
- **THEN** the dispatcher catches the error AND updates the sticky to
  a terminal body that names the failure (and links the workflow run
  URL when available)

#### Scenario: Visible noop writes terminal only
- **WHEN** the classifier returns a visible noop (e.g. `openspec:go`
  on a closed issue)
- **THEN** the dispatcher upserts a terminal sticky containing the
  noop reason and does NOT write a working state first

### Requirement: Status upsert failures do not block handlers

The dispatcher SHALL treat sticky-comment API failures as best-effort:
a non-2xx response from `listComments`, `createComment`, or
`updateComment` SHALL be logged as a warning and SHALL NOT prevent the
handler (`handleCreateSpec`, `handleCreateImpl`) from running. The
status comment is UX polish; the handler's work is the primary
deliverable.

#### Scenario: List-comments fails
- **WHEN** `octokit.issues.listComments` returns a non-2xx response
  during sticky lookup
- **THEN** the dispatcher logs a warning AND proceeds to invoke the
  handler as normal

#### Scenario: Update-comment fails
- **WHEN** `octokit.issues.updateComment` returns a non-2xx response
- **THEN** the dispatcher logs a warning AND proceeds to invoke the
  handler as normal

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
