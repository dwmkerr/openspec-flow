# tests/scripts — manual & smoke tests

Bash scripts that exercise the bot end-to-end against a real GitHub
repository. Each script creates a fresh fixture (issue or PR), applies
the trigger label, then exits. You watch the `make dev` pane and the
issue/PR page in the browser to verify the bot reacts as expected.

Every fixture carries the shared `test:fixture` label. When you're
done, wipe everything with:

```bash
make test-cleanup
```

Idempotent. Safe to re-run.

## Prerequisites

- `make dev` running (Probot + tsx watch on `:3000`)
- `make tunnel` running (ngrok forwarding to `:3000`)
- `gh` CLI authenticated against `dwmkerr/openspec-flow` (or override
  with `SANDBOX_REPO=owner/repo`)

## Scripted tests

| Script | Trigger | Expected intent | Expected on issue/PR |
|---|---|---|---|
| `test-create-issue.sh` | Open issue + `openspec:go` | `create-spec` | 👀 reaction, then comment: *create specification for issue #N* |
| `test-closed-issue-noop.sh` | Closed issue + `openspec:go` | visible noop | 👀 reaction, then comment: *Issue #N is closed. Reopen first.* |
| `test-foreign-pr-noop.sh` | PR without `openspec:spec`/`openspec:impl` + `openspec:go` | visible noop | 👀 reaction, then comment: *PR #N is not managed by openspec-flow* |

Run any of them via `make test-create-issue`, `make test-closed-issue-noop`,
`make test-foreign-pr-noop`.

## Manual tests (not yet scripted)

The classifier handles more intents than the scripts cover. Reproduce
these by hand against the dev repo.

### `iterate-spec` — `openspec:go` on a spec PR

1. Open any PR against `main` (e.g. `gh pr create -t test -b test`).
2. Add `openspec:spec` to it manually via the GitHub UI.
   Expected: 👀 + visible noop comment about `openspec:spec` being
   bot-managed (since you applied it, not the bot — see
   *transfer-mode* below).
3. To exercise the actual `iterate-spec` intent, the PR must already
   carry `openspec:spec` because the bot opened it. End-to-end test
   blocked until the `create-spec` handler is wired (next phase).

### `iterate-impl` — `openspec:go` on an impl PR

Same blocker as `iterate-spec`. Requires the bot to have opened an
impl PR. Will become testable once the `create-impl` handler is
wired.

### `create-impl` — merging a spec PR

Same blocker. Requires a bot-opened spec PR to merge.

### Visible noops you can reproduce by hand

| Scenario | Steps |
|---|---|
| `openspec:go` on a closed PR | Open PR, close it, add `openspec:go` |
| PR with both lifecycle labels | Open PR, apply both `openspec:spec` and `openspec:impl`, then `openspec:go` |
| Spec PR closed unmerged | Open PR, apply `openspec:spec`, close without merging |
| User applies `openspec:spec` manually (transfer mode) | Open PR, apply `openspec:spec` yourself |
| User applies `openspec:impl` manually (transfer mode) | Same with `openspec:impl` |

For each: 👀 reaction + visible-noop comment explaining why the bot
isn't acting.

## What "silent noop" means

A silent noop is logged in the `make dev` pane but produces no
reaction and no comment on the issue/PR. Examples:

- Bot-sender events (e.g. the bot's own comments)
- Non-trigger label changes (`bug`, `enhancement`, …)
- `issue_comment.created` events

If you trigger one of these and see anything appear on the issue,
that's a bug — open an issue.

## Watching the bot react

Two things to watch:

1. **Browser** — refresh the issue/PR. Expect 👀 within ~1s, comment
   within ~2s.
2. **`make dev` pane** — every event logs a structured `INFO (event)`
   line with `event`, `target`, `intent`, `summary`. If you don't see
   one, the webhook didn't reach the dev server — check `make tunnel`
   and the ngrok inspector at <http://127.0.0.1:4040>.

## After testing

```bash
make test-cleanup
```

Deletes every issue and closes every PR labelled `test:fixture`. The
single source of truth — anything without the marker is left alone.
