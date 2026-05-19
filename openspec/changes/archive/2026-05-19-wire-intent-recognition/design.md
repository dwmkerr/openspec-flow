# Design — wire-intent-recognition

Per-intent design notes. High-level only; the authoritative trigger table
lives in `CLAUDE.md`. Failure contracts are uniform: the classifier
returns a typed `Intent`, the dispatcher logs structured context, and any
error inside the dispatcher is logged but never re-thrown (we don't want
Probot to retry on classification logic bugs).

## create-spec

- **Triggers**: `issues.labeled` where `label.name === "openspec:go"`, the
  issue is open, and the issue is not a pull request.
- **Inputs**: issue number, issue title.
- **Outputs (future)**: spec PR opened on branch `chore/<n>-<slug>`,
  labelled `openspec:spec`, with metadata block linking back to the
  issue.
- **Failure contract**: classifier never fails; handler implementation
  (later) must log and surface errors via a failure comment.

## iterate-spec

- **Triggers**: `pull_request.labeled` with `openspec:go` added, PR
  carries `openspec:spec`, PR is open.
- **Inputs**: PR number; iterate handler reads PR body, conversation,
  and existing change directory.
- **Outputs (future)**: amended commits on the spec branch updating
  proposal/design/specs/tasks; the `openspec:go` label is removed after
  the run.

## iterate-impl

- **Triggers**: same as iterate-spec but with `openspec:impl` on the PR.
- **Inputs**: PR number; handler reads PR review comments + impl branch.
- **Outputs (future)**: amended commits on the impl branch; label
  removed after run.

## create-impl

- **Triggers**: `pull_request.closed` with `merged: true` and
  `openspec:spec` on the PR.
- **Inputs**: spec PR number, issue number (extracted from
  `Closes #N` in the PR body).
- **Outputs (future)**: impl PR opened on branch `feat/<n>-<slug>`,
  labelled `openspec:impl`, with metadata block linking back to the
  spec PR and originating issue.

## Visible-noop catalogue

Each case posts a comment so the user understands why the bot didn't
act:

- `openspec:go` on a closed issue or PR
- `openspec:go` on a PR with neither `openspec:spec` nor `openspec:impl`
- `openspec:go` on a PR carrying both lifecycle labels
- Spec PR closed without merging
- User manually applies `openspec:spec` or `openspec:impl` (transfer
  mode: the bot stops touching that PR)

All other unrecognised events are silent noops — logged, no comment.
