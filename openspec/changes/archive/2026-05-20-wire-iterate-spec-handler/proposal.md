## Why

We have spec PRs landing and impl PRs landing. The remaining beat
is iteration: a user reviews the spec PR, adds review comments,
applies `openspec:go` on the PR, and the agent updates the spec in
place. Without it, you have to close the PR + re-trigger from the
issue, which loses the review context.

The classifier already emits `iterate-spec` for
`pull_request.labeled` events on a PR carrying `openspec:spec`. The
dispatcher posts the classifier comment but no handler runs. This
change wires the handler.

## What Changes

- **`handleIterateSpec`** mirrors `create-spec`'s agent/bot split:
  - Bot: clone the target repo, check out the spec branch, parse
    the spec PR body's metadata block to recover `change` + `issue`,
    invoke the agent, commit + force-push the spec branch, post a
    "spec updated" comment on the PR.
  - Agent: reads the issue body + every PR review comment via `gh`
    to understand what the reviewer wants changed, edits the
    openspec change's artefacts in place, runs `openspec validate
    <change-name>` until clean.
- **No new branch, no new PR.** The existing spec PR stays open on
  the existing `chore/<n>-<slug>` branch. Push uses the explicit
  `--force-with-lease=<branch>:<sha>` form we already use elsewhere
  to protect against concurrent writers.
- **Dispatcher wires `iterate-spec` intent**: identical pattern to
  `create-spec` / `create-impl` — mint installation token, call
  `handleIterateSpec`, catch + log on error.
- **CLI subcommand**: `openspec-flow handle iterate-spec --pr <n>
  --repo <owner/repo>` for Action mode / local debug. Same Octokit
  construction (from `gh auth token`).
- **Agent prompt** frames `gh` as the tool and lists the feedback
  surfaces (issue body + comments, PR comments, inline review
  comments, reviews, plus anything else the reviewer references —
  CI runs, related PRs, workflow logs) without prescribing a fixed
  sequence of commands. Specific `gh` invocations are included as
  non-exhaustive examples. The agent is told to use whatever `gh`
  capabilities it needs to understand what the reviewer wants, and
  to ignore comments authored by `openspec-flow[bot]`.
- **Failure handling** (option A again): single visible comment on
  the spec PR — `❌ openspec-flow couldn't iterate the spec: <err>`
  — then re-throw so the dispatcher logs the stack.

## Capabilities

### New Capabilities

- `iterate-spec-handler`: in-place spec PR iteration. Defines the
  handler contract, the agent / bot work split, the post-agent
  verification, and the failure-comment contract.

### Modified Capabilities

- `intent-recognition`: dispatcher routes the `iterate-spec`
  intent to the new handler.
- `openspec-flow`: the iterate-spec beat is now real end-to-end —
  reviewers can apply `openspec:go` on a spec PR and the bot
  rewrites the spec in place.

## Impact

- New files: `src/handlers/iterate-spec/{index.ts,prompt.md,index.test.ts}`.
- Modified: `src/index.ts` (dispatcher routes the intent),
  `src/cli.ts` (new subcommand).
- New deps: none.
- Cost: one Claude session per iterate. Larger than create-spec
  because the agent has to digest review context.

## Out of scope

- `iterate-impl` handler — next change, same shape but for impl
  branches.
- Marking review comments as resolved by the bot.
- Rebasing the spec branch onto main if main has moved (the change
  is small enough that we keep the spec branch as-is).
- Multi-turn review (resolve-then-iterate) — single iteration per
  `openspec:go` label re-application.
