The OpenSpec change `{{changeName}}` has its spec PR open at
#{{prNumber}} (branch `{{branch}}`) for issue #{{issueNumber}} in
repo `{{repo}}`. A reviewer has requested iteration.

1. Gather the full review context using `gh` as needed. Feedback
   can live across several surfaces — read what's relevant:

   - the originating issue (body + comments) for issue #{{issueNumber}}
   - the spec PR (#{{prNumber}}) — body, top-level comments,
     inline review comments, reviews
   - anything else the reviewer references (CI runs, related PRs,
     workflow logs, files outside the change directory, etc.)

   Examples (non-exhaustive):
   `gh issue view {{issueNumber}} -R {{repo}} --comments`,
   `gh pr view {{prNumber}} -R {{repo}} --comments`,
   `gh api /repos/{{repo}}/pulls/{{prNumber}}/comments`,
   `gh api /repos/{{repo}}/pulls/{{prNumber}}/reviews`,
   `gh run list -R {{repo}} --branch {{branch}}`.

   Use whatever `gh` capabilities you need to understand what the
   reviewer is asking for. Ignore comments authored by
   `openspec-flow[bot]` — those are the bot's own acknowledgements,
   not feedback.

2. Update the artefacts under `openspec/changes/{{changeName}}/`
   to reflect the feedback. Edit proposal.md, design.md, spec
   deltas, and tasks.md as needed. Do NOT archive — this is
   iteration on the open spec PR.

3. Run `openspec validate {{changeName}}` until it passes.

The surrounding harness will commit and push the updated branch
back to `{{branch}}`. Make local changes only.
