# Design — wire-iterate-spec-handler

## Mirror, with one structural difference

The handler reuses the helpers we built for `create-spec`:
`createWorkdir`, `removeWorkdir`, `cloneRepo`, `configIdentity`,
`fetchAndCheckoutBranch`, `addAll`, `commit`, `pushBranch`,
`assertOpenSpecCli`, `assertSkillPresent`, `parseSpecPrMetadata`.

The structural difference vs `create-spec` is that **no new branch
and no new PR** are created. The handler updates the existing
spec branch and lets the existing PR's diff refresh on its own.

## Handler flow

1. `workdir = $OPENSPEC_FLOW_WORKDIR/iterate-spec-<pr>-<unix-ts>`
2. `git clone --depth 50 <repo> workdir`
3. `git -C workdir config user.{name,email} = <bot identity>`
4. `octokit.pulls.get({pull_number: prNumber})` — fetch PR body +
   `head.ref` (branch name) + `state`.
5. Refuse if PR is closed (`state !== "open"`) — visible failure
   comment, abort.
6. `parseSpecPrMetadata(pr.data.body)` → `{ change, issue }`. If
   missing or not `kind: spec`, abort with visible failure.
7. `fetchAndCheckoutBranch(workdir, pr.data.head.ref)` — workdir
   now reflects the current state of the spec PR.
8. Preconditions: `openspec --version`, `.claude/skills/openspec-new-change/`
   present.
9. Render prompt with `{{changeName}}`, `{{prNumber}}`,
   `{{issueNumber}}`, `{{branch}}`, `{{repo}}`.
10. `runAgent({ prompt, cwd: workdir, log, env: { GH_TOKEN },
    options: { permissionMode: "bypassPermissions" } })`. Agent
    uses `gh issue view --comments` + `gh pr view --comments` to
    digest review context, then edits the change's artefacts.
11. **Post-agent verify**: `git status --porcelain` is non-empty
    (agent actually changed something) AND
    `openspec/changes/<change>/` still exists (agent didn't
    accidentally archive). If either fails, abort.
12. `git add -A` + `git commit -m "chore: iterate spec for #<issue>"`
13. `pushBranch(workdir, branch)` — same explicit-lease push as
    create-spec.
14. Comment on the spec PR: `spec updated by openspec-flow`
    (one-line, low-noise — reviewers can diff via GitHub).
15. Cleanup workdir.

## Post-agent verification

| Check | Why |
|---|---|
| `git status --porcelain` non-empty | Agent actually edited something |
| `openspec/changes/<name>/` still exists | Agent didn't accidentally archive |
| (No archive-dir-must-exist check) | Iterate ≠ archive; archive is impl-time |

If verify fails, abort before push. Comment on PR with reason.

## Failure handling

Single try/catch at the boundary:

| Failure | Behaviour |
|---|---|
| Clone / preconditions / fetch | Failure comment on PR, throw |
| PR is closed | Failure comment on PR, throw |
| Metadata block missing or not `kind: spec` | Failure comment on PR, throw |
| Agent error | Failure comment on PR, throw |
| Verify fails | Failure comment on PR, throw |
| Push fails (lease violation = concurrent writer) | Failure comment on PR, throw |
| PR comment fails (transient 422 / 403) | Swallow + log — work landed on the branch already |

## Why agent reads PR comments instead of bot pre-fetching

Same reasoning as create-spec: the agent's prompt stays small, the
mechanism is symmetric with iterate-impl when we ship it, and tool
calls show in the dev pane log (operators see Claude fetching). The
handler injects `GH_TOKEN` so the agent's Bash subprocess can run
`gh pr view <n> -R <repo> --comments`.

## Why we don't open a new PR for iteration

The reviewer applied `openspec:go` on the existing spec PR. Their
mental model is "update this PR." A new PR would orphan the review
context. Force-pushing the existing branch updates the diff in
place — exactly what review tools expect.

## Concurrent-writer protection

`pushBranch` already does explicit `--force-with-lease=<branch>:<sha>`
after `ls-remote`. If a reviewer pushed a manual fix between our
`ls-remote` and our push, the lease fails, the handler catches, and
the visible failure comment names the conflict so the reviewer
knows to re-trigger after their fix lands.

## CLI subcommand

```
openspec-flow handle iterate-spec --pr <n> --repo <owner/repo>
```

Same Octokit construction as the other CLI subcommands (token from
`gh auth token`). Useful for retriggering after a flaky run without
toggling labels.
