# How it works

The richer version of the README's "how it works" — every state of the flow with a screenshot of the sticky comment that lives on the issue and is mirrored to the spec / implementation PRs.

## The flow

1. **Label an issue** with `openspec:go`.
2. **The specification PR opens automatically.** Review, comment, or push back. Re-apply `openspec:go` on the PR to update the spec based on the discussion. Merge when ready.
3. **The implementation PR is raised** (archiving the change). Re-apply `openspec:go` after comments or discussion to improve the implementation.
4. **Merge the implementation PR.** The original issue closes automatically.

You apply one label. The bot applies the rest.

| Label | Applied by | Meaning |
|---|---|---|
| `openspec:go` | **you** | Trigger. Add to an issue to start; add to a PR to re-run iteration. |
| `openspec:spec` | bot | Specification PR — review the proposal, then merge. |
| `openspec:impl` | bot | Implementation PR — review the code, then merge to ship. |

## The sticky comment

A single comment lives on the issue, mirrored to every PR raised for the flow. It updates as the agent works so you always know where you are and what to do next. The comment looks like this at each state:

### 1. You label the issue

The bot acknowledges within ~1 second (with the App) or as soon as the workflow runner spins up (with the shim, ~30 seconds).

![Preparing the specification](./previews/01-pregate-preparing-spec.png)

### 2. The agent is drafting the specification

The workflow has started. The row tells you which workflow run to watch.

![Creating the specification](./previews/02-spec-creating.png)

### 3. The specification PR is ready for review

The agent finished. The PR is open. The comment tells you what to do next: merge to advance, or comment + apply `openspec:go` to iterate.

![Awaiting review of the spec PR](./previews/03-spec-pr-awaiting-review.png)

### 4. You commented and re-applied `openspec:go` to iterate

The agent is updating the spec PR based on the discussion. Same comment, new state.

![Iterating on the spec PR](./previews/04-spec-pr-iterating.png)

### 5. You merged the spec PR — the agent is drafting the implementation

Specification row shows the merged PR. Implementation row shows the active run.

![Creating the implementation](./previews/05-impl-creating.png)

### 6. The implementation PR is ready for review

Review the code. Merge to close the issue, or comment + apply `openspec:go` to iterate.

![Awaiting review of the implementation PR](./previews/06-impl-pr-awaiting-review.png)

### 7. You commented and re-applied `openspec:go` to iterate the implementation

Same pattern. The agent updates the implementation PR in place.

![Iterating on the implementation PR](./previews/07-impl-pr-iterating.png)

### 8. Something went wrong

If the run fails, the comment surfaces the warning + the reason. Click through to the workflow run for details. Apply `openspec:go` after fixing the cause to retry.

![Run failed during implementation](./previews/08-failed.png)

### 9. You merged the implementation PR

The flow is complete. The original issue closes automatically.

![Completed](./previews/09-completed.png)

## Two variants of the same comment

### Inline agent step

When the agent is actively working, the active row shows what it's doing right now — `gathering context`, `implementing the change`, `pushing` — without you having to click through to the workflow run.

![Creating with inline step](./previews/10-creating-with-step.png)

### Mirrored on the pull request

The same comment is mirrored to every PR raised for the flow, prefixed with a link back to the originating issue.

![PR variant with tracked-on-issue header](./previews/11-pr-variant-spec-iterating.png)

### Without the App installed

If you're using the shim instead of the App, the comment carries a small hint that App installation gives you real-time feedback. Everything else operates identically.

![App not installed — install hint visible](./previews/12-app-not-installed-hint.png)

## See also

- [The flow itself, in plain English](../README.md) — the short version.
- [`docs/developer-guide.md`](./developer-guide.md) — how to build, test, and run openspec-flow locally.
- [`docs/architecture.md`](./architecture.md) — system design.
- [`docs/state-machine.md`](./state-machine.md) — formal state model the renderer follows.
