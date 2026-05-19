## Why

Phase 1 recognises exactly one intent (`create-spec`) on one event
(`issues.labeled`) and stubs the response. To handle the full flow we
need every event the bot cares about to map to a typed intent
deterministically — before we wire any side effects. Get the
classification layer rock-solid and fully tested first, then plug in
real handlers (Claude calls, git ops, PR creation) one phase at a time
without churning the plumbing.

## What Changes

- Define the `Intent` discriminated-union type: `create-spec`,
  `iterate-spec`, `create-impl`, `iterate-impl`, `noop`. Noop carries a
  `visible` flag and a `reason` string so we can distinguish
  "ignored event" from "trigger looked right but state was wrong".
- Implement a pure `classify(eventName, payload) → Intent` function. No
  network, no I/O. Inputs: webhook event name + payload. Outputs:
  typed intent.
- Cover these trigger events: `issues.labeled`, `issues.closed`,
  `pull_request.labeled`, `pull_request.closed` (with `merged: true`
  detection). Other subscribed events (`issue_comment.created`,
  `pull_request_review.submitted`, `pull_request_review_comment.created`)
  classify to silent `noop` — they are visibility-only, never triggers.
- The deterministic trigger is always `openspec:go` (or a merge event
  on a lifecycle-labelled PR). No body-scanning, no mention regex.
  Comments are read by the iterate handlers as context, never as
  triggers.
- Wire the dispatcher in `src/index.ts` to log every intent and post a
  classifier comment when the intent is "actionable or visible-noop".
  Silent noops log only. No side effects beyond comments.
- Branch convention for future PRs (recorded in `CLAUDE.md`):
  spec PRs use `chore/<issue-number>-<slug>`, impl PRs use
  `feat/<issue-number>-<slug>`. The impl prefix is configurable per
  issue type later (`ideas.md`).
- Linkage convention for future PRs: each bot-opened PR ends with an
  HTML-comment metadata block carrying `issue`, `kind`, `change`, and
  (impl only) `spec-pr`. A pure parser/serializer pair
  (`src/metadata.ts`) handles read/write. This change ships the
  parser/serializer; no PRs are opened yet.
- Cover edge-case visible noops with clear reasons:
  - `openspec:go` on an issue that already has an open spec PR
  - `openspec:go` on a PR missing both `openspec:spec` and `openspec:impl`
  - `openspec:go` on a closed issue/PR
  - `openspec:go` on a PR carrying both lifecycle labels
  - Spec PR closed unmerged (no impl PR will open)
  - User applies a bot-managed label (`openspec:spec` or `openspec:impl`)
    manually
- Add one short design doc per intent under
  `openspec/changes/wire-intent-recognition/design.md`. Each section:
  triggers, inputs, outputs, failure contract. High-level only.
- Integration tests: fire fixture payloads from
  `@octokit/webhooks-examples` plus hand-crafted edge cases through
  `probot.receive()` and assert the classifier's output and the
  resulting comment body. One test per intent + every visible-noop case
  + a spot check that silent-noop events post no comment.

## Capabilities

### New Capabilities

- `intent-recognition`: deterministic classification of GitHub webhook
  events into typed openspec-flow intents. Spec describes every
  trigger, every intent, the visible-noop catalogue, and the
  comment-posting contract for the Probot dispatcher.

### Modified Capabilities

None this slice. The existing `openspec-flow` capability (workflow-mode
behaviour) is unchanged. A later change introduces
`create-spec-handler` and reconciles the two.

## Impact

- New: `src/intent.ts` (extended type + classifier),
  `src/intent.test.ts`, `tests/integration/intent.test.ts`,
  `tests/fixtures/` (curated webhook payloads).
- Modified: `src/index.ts` (dispatch all events via classifier).
- New deps: none. `@octokit/webhooks-examples` and `nock` already in
  devDependencies.
- No deployment impact yet — handlers still stub. Cost stays at $0.

## Out of scope

- Actually opening spec/impl PRs (next change)
- Running Claude (next change)
- Cloning target repos (next change)
- Cleaning up orphan PRs when a user closes an issue mid-flow
- Updating workflow files (later change)
- `archive` as a distinct intent. The impl PR's own commits include
  the OpenSpec archival of `openspec/changes/<name>/` →
  `openspec/specs/`. Merging the impl PR is the end state.
- `cancel` as a distinct intent. User-closed issues just stop the flow;
  any orphan spec PR stays open for the user to handle.
