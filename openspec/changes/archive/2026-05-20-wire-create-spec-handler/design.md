# Design — wire-create-spec-handler

## Agent / bot split

```
                                cloned target repo at workdir
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
   ┌────┴──────┐              ┌──────┴───────┐             ┌──────┴──────┐
   │ Precondit │              │   Agent      │             │  Bot        │
   │ ions      │              │  (Claude)    │             │ (handler)   │
   ├───────────┤              ├──────────────┤             ├─────────────┤
   │ openspec  │              │ uses         │             │ branch,     │
   │ binary    │     ──►      │ openspec-    │     ──►     │ commit,     │
   │ skill     │              │ new-change   │             │ push, PR,   │
   │ present   │              │ skill        │             │ comment     │
   └───────────┘              └──────────────┘             └─────────────┘
```

The agent's only deliverable is filesystem state: one or more new
directories under `openspec/changes/<name>/`. The bot reads that
state and ships it. Claude doesn't touch git, gh, or the network.

## Handler flow

1. Build `workdir = $OPENSPEC_FLOW_WORKDIR/<issue-N>-<unix-ts>`
2. `gh repo clone owner/repo workdir -- --depth 50`
   (depth 1 is too shallow if the agent needs to look at history)
3. `git -C workdir config user.{name,email} = <bot identity>`
4. Precondition checks (abort with visible comment if any fail):
   - `which openspec` (or `command -v`)
   - `[ -d workdir/.claude/skills/openspec-new-change ]`
5. Render `prompt.md` with `{{issueNumber}}`, `{{issueTitle}}`,
   `{{repo}}`. Prompt frames the job positively: "make local
   changes only; the surrounding agent will branch, commit, push,
   and open the PR for you; use whatever tools you need to fetch
   issue context." No denylist.
6. `runAgent({ prompt, cwd: workdir, log, env: { GH_TOKEN } })`.
   No tool restrictions. Agent will naturally use Bash for
   `gh issue view`, `openspec new change`, `openspec validate`.
7. After agent returns, list `workdir/openspec/changes/*/` excluding
   `archive/`. If zero, abort with visible comment.
8. Derive branch name: `chore/<n>-<kebab(issueTitle)>`.
9. `git -C workdir checkout -b <branch>`
10. `git -C workdir add -A`
11. `git -C workdir commit -m "chore: <issueTitle>"`
12. `git -C workdir push -u <token-url> <branch>`
13. `octokit.pulls.create({ title, head, base:"main", body })`:
    body ends with the metadata HTML comment block.
14. `octokit.issues.addLabels({ labels: ["openspec:spec"] })`
15. `octokit.issues.createComment({ issue, body: "spec PR opened: #M" })`
16. Cleanup workdir unless `OPENSPEC_FLOW_KEEP_WORKDIR=true`.

Every step that can fail is wrapped at the handler boundary in a
single try/catch that posts the failure comment and re-throws to
the dispatcher (which logs but does not crash the webhook).

## Branch slug

Derived in code, not by Claude. Algorithm:

```ts
const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 50);
// branch = `chore/${issueNumber}-${slug}`
```

Deterministic, idempotent. If the branch already exists (re-trigger
on the same issue), the handler force-pushes it. PR open call uses
`gh pr list --head <branch>` first; if a PR is already open on
the branch, the handler updates the existing one instead of opening
a new one.

## PR body template

```
<short summary derived from the change's proposal.md>

Closes #{{issueNumber}}.

<!-- openspec-flow:auto-maintained — do not remove or edit
issue: {{issueNumber}}
kind: spec
change: <change-name>
-->
```

The short summary is the first non-heading paragraph of the
agent-authored `proposal.md`. Read in code, not by Claude.

## Auth surfaces

| Mode | Octokit | git push token |
|---|---|---|
| App / Probot | `context.octokit` (installation token) | extract token via `octokit.auth({ type: "installation" })`, inject into push URL |
| CLI / local | new Octokit from `gh auth token` | reuses local `gh auth` (gh writes a credential helper) |
| Action (future) | from `GITHUB_TOKEN` | from `GITHUB_TOKEN` |

The handler accepts an `octokit` instance + an opaque `gitPushToken`
string. Both modes construct these before calling the handler.

## Failure comment

Single template, one line:

```
❌ openspec-flow couldn't open a spec PR: <error message>. See dev logs for trace.
```

Posted on the originating issue via `octokit.issues.createComment`.
Followed by `throw` so the dispatcher's outer try/catch logs the
full error with stack.

## Why we don't restrict Bash inside the agent

The agent's only sane way to use the `openspec-new-change` skill is
to spawn `openspec` itself. If we deny Bash we'd have to whitelist
`openspec` specifically — brittle. Better: trust the prompt to keep
Claude away from `git`/`gh`, and add a Bash hook later if we want a
deny-list (recorded in `ideas.md`).

## Why we don't parse Claude's reply

The bot opens the PR via Octokit and receives `response.data.number`
+ `response.data.html_url` directly. No regex on the agent's output.
The agent's reply text is logged for visibility but never used as
control flow.

## Multiple changes

The prompt asks Claude for one change per issue. The precondition
allows multiple to land — sometimes a cross-cutting issue genuinely
spans capabilities and Claude legitimately creates two changes.
The bot commits and PR-opens whatever is there. The reviewer can
then ask Claude (via `openspec:go` on the spec PR) to merge them
into one if needed. Don't over-constrain.

## Failure modes summary

| Failure | Behaviour |
|---|---|
| Clone fails (network, auth) | Failure comment + throw |
| `openspec` not in PATH | Failure comment naming the missing binary |
| Skill dir missing | Failure comment pointing at `openspec init` |
| Agent throws | Failure comment with agent error |
| Agent produces no change | Failure comment "agent didn't create any openspec changes" |
| `git push` fails | Failure comment with git stderr (last line) |
| PR open fails (e.g. branch exists with different PR) | Failure comment |
| Issue comment fails (Octokit 403) | Logged, no re-throw — the PR is already open, user can find it |
