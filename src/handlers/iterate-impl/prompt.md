The implementation PR for change `{{changeName}}` is open at
#{{prNumber}} (branch `{{branch}}`) for issue #{{issueNumber}} in
repo `{{repo}}`. A reviewer has requested iteration on the
implementation.

1. Gather the full review context using `gh` as needed. Feedback
   can live across several surfaces — read what's relevant:

   - the impl PR (#{{prNumber}}) — body, top-level comments,
     inline review comments, reviews
   - the originating issue (body + comments) for issue #{{issueNumber}}
   - CI runs on the impl branch, related PRs, files in the diff
   - any docs, tests, or source the reviewer references

   Examples (non-exhaustive):
   `gh pr view {{prNumber}} -R {{repo}} --comments`,
   `gh api /repos/{{repo}}/pulls/{{prNumber}}/comments`,
   `gh api /repos/{{repo}}/pulls/{{prNumber}}/reviews`,
   `gh issue view {{issueNumber}} -R {{repo}} --comments`,
   `gh run list -R {{repo}} --branch {{branch}}`.

   Ignore comments authored by `openspec-flow[bot]` or
   `openspec-flow-dev[bot]` — those are the bot's own
   acknowledgements, not feedback.

2. **Mutation scope.** This is iterate-impl, not iterate-spec.
   You SHALL modify code, tests, and docs under any of:

   - `src/`
   - `tests/`
   - `docs/`
   - `public/`
   - root files (`README.md`, `CLAUDE.md`, `package.json`, etc.)

   You SHALL NOT modify any of:

   - `openspec/changes/` — spec deltas belong to iterate-spec
   - `openspec/specs/` — canonical specs are merged-only
   - `.github/workflows/openspec-flow.yml` — managed elsewhere

   If reviewer feedback genuinely requires a spec change, comment
   on the PR explaining that the spec PR for `{{changeName}}` needs
   to be reopened or a follow-up spec change filed. Do NOT touch
   the spec from here.

3. Verify your changes before committing:

   - `npm run typecheck`
   - `npm test`

   Fix anything that breaks. If a test was already broken on the
   branch before you started, leave it broken and note it in the
   commit message — don't fix unrelated regressions.

4. **Commit when done.** Stage your changes with `git add` and
   make a commit whose message follows Conventional Commits
   (`feat:`, `fix:`, `docs:`, …) and describes what this iteration
   changed (e.g. "fix: handle empty PR body in metadata parser").
   The harness will push your commit to `{{branch}}` — don't push
   yourself.
