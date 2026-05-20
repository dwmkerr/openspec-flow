# Design — eyes-ack-and-fixture-cleanup

## Eyes reaction

### Where it lives

In `src/index.ts` dispatcher. New helper `reactEyes(context, issueNumber)`
called immediately before `issues.createComment(...)`, gated on the same
`isActionable(intent) || (intent.kind === "noop" && intent.visible)`
condition that already gates the comment.

### Endpoint

`POST /repos/{owner}/{repo}/issues/{issue_number}/reactions`
with body `{ content: "eyes" }`. Works for both issues and PRs — PRs
are issues at this endpoint. GitHub returns `201` for a new reaction
and `200` for an existing one (same user, same content); both are
success. No client-side dedup needed.

### Failure contract

The reaction is best-effort. Network failure, missing scope, or any
non-2xx response logs a warning with `eventContext(context)` and
returns. The dispatcher continues to post the comment. Rationale:
the comment is the substantive ack; the reaction is the fast ack.
Losing the reaction degrades UX but doesn't break the flow.

### What does NOT get a reaction

Silent noops. Specifically:

- Bot senders (`sender.type === "Bot"`)
- Non-trigger label adds
- `issue_comment.created` / `pull_request_review.*` events that
  classify to silent noop

Silent means silent: no comment, no reaction, log only.

### Why not a comment reaction?

Future iterate flows will likely add reactions to specific user
comments (e.g. on `iterate-spec` we might react `eyes` on the latest
review comment that the bot is responding to). That's a separate
endpoint (`/repos/{owner}/{repo}/issues/comments/{comment_id}/reactions`)
and a separate change. This change covers the issue/PR-level ack only.

## Fixture label

### Contract

Every artefact created by a `tests/scripts/test-*.sh` script carries
the label `test:fixture` in addition to its scenario label. The
fixture label is the single source of truth for `test-cleanup`.

### Label metadata

- name: `test:fixture`
- color: `d73a4a` (red — visually distinct from green `openspec:*` labels)
- description: `Test artefact — safe to delete`

The scenario labels keep their existing color (`ededed` grey) and
remain useful for per-script isolation during a run.

### Helper

`tests/scripts/_lib.sh` gains `create_fixture_issue` that wraps
`create_issue` and ensures `test:fixture` exists before applying
both labels. Existing `create_issue` stays for callers that want
the raw primitive but is no longer used by the three test scripts.

### Cleanup script

`tests/scripts/cleanup.sh`:

1. Enumerate issues with `--label test:fixture --state all` → delete.
2. Enumerate PRs with `--label test:fixture --state all` → close
   with `--delete-branch`. PRs cannot be deleted via the REST API
   without admin scope, so close is the best we get.
3. Print a summary of what was touched.

Exits 0 even if nothing matched (idempotent).

### Orphan recovery

Issues #1, #2, #5 predate the fixture label. The script can't see
them. Two options, documented in tasks.md:

- **Recommended**: back-fill `test:fixture` on the orphans, then run
  `make test-cleanup`. One-line `gh issue edit` per issue.
- Alternative: `gh issue delete <n>` manually, one at a time.

Going forward, every test script applies the marker at creation
time, so this is a one-time chore.

## Failure modes summary

| Failure | Behaviour |
|---|---|
| Reactions API 5xx | Warn-log, proceed to comment |
| Reactions API 403 (scope) | Warn-log, proceed to comment |
| Comment API failure | Existing behaviour — error propagates |
| `test-cleanup` partial failure | Reports per-item, exits non-zero only if final summary count mismatches |
