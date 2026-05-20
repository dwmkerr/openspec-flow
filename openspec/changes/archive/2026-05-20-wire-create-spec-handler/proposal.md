## Why

The stub `create-spec` handler proved the runtime is wired: Claude
responds, every chunk lands in the dev pane, the dispatcher routes
the intent. The next move is to make the handler do real work — open
an actual spec PR.

The split between agent work and bot mechanics matters. Anything
deterministic (branch naming, commit format, PR body metadata,
labelling) belongs to the bot. Anything that requires reading
context, drafting prose, or scaffolding files belongs to the agent.
This keeps Claude's tool surface small, eliminates a `GH_TOKEN`
exposure, and makes the failure modes predictable.

## What Changes

- **Real `handleCreateSpec`**: clones the target repo, runs an agent
  invocation, then performs the git + PR machinery itself.
- **Workdir lifecycle**: `OPENSPEC_FLOW_WORKDIR/<issue-N>-<timestamp>`
  cloned shallow, removed on exit unless `OPENSPEC_FLOW_KEEP_WORKDIR=true`.
- **Precondition checks** before invoking the agent:
  - `openspec` CLI available in `PATH` (`openspec --version`).
  - `.claude/skills/openspec-new-change/` exists in the target repo.
    If missing, abort with a visible comment pointing the user at
    `openspec init`.
- **Agent fetches issue context itself**: the prompt tells Claude
  to start with `gh issue view <n> -R <repo> --comments` and read
  everything before drafting. Bot does NOT pre-fetch + inline. Keeps
  the prompt small and matches the pattern iterate handlers will
  need (read PR comments). The handler passes a `GH_TOKEN` env var
  through `runAgent` so the agent's Bash subprocess can auth.
- **Agent prompt narrowed**: tells Claude to use the
  `openspec-new-change` skill (auto-discovered by the SDK from the
  target repo's `.claude/skills/`) to scaffold an OpenSpec change
  describing the work. No instructions on git, branches, commits,
  PRs, or metadata blocks — those are deterministic and the bot
  handles them.
- **Bot-side mechanics after the agent finishes**:
  - Verify at least one new directory under `openspec/changes/` —
    abort with a visible comment if zero.
  - Derive `chore/<n>-<slug>` from the issue title (kebab-case).
  - Configure `git user.name`/`user.email` to the bot identity.
  - `git checkout -b <branch>`, `git add -A`, `git commit -m
    "chore: <issue title>"`, `git push -u origin <branch>`.
  - Open a spec PR via Octokit: body ends with the
    auto-maintained metadata HTML comment block per `CLAUDE.md`,
    label `openspec:spec`, base `main`.
  - Post a comment on the originating issue: `spec PR opened: #M`.
- **Failure handling**: any exception in the handler (clone failure,
  precondition fail, agent error, git push fail, PR open fail) is
  caught at the handler boundary and surfaces as one visible comment
  on the issue: `❌ openspec-flow couldn't open a spec PR:
  <error>. See dev logs for trace.` Workdir is preserved if
  `OPENSPEC_FLOW_KEEP_WORKDIR=true`.
- **Auth surfaces**:
  - **App mode**: Octokit comes from Probot's per-event installation
    token (already plumbed); git push uses the same token via
    `https://x-access-token:<token>@github.com/...` URL.
  - **CLI mode**: reuses the developer's `gh auth` for both the PR
    creation and the git push (no special token plumbing).
  - **Action mode (later)**: `GITHUB_TOKEN` provided by the workflow.
  - Claude itself never sees any GitHub token. Bash is allowed
    inside the agent so it can run `openspec validate` etc., but the
    prompt does not direct Claude to `git` or `gh`.
- **README + docs**: brief docs note describing the agent / bot
  split, the three auth modes, and the workdir lifecycle. Lives in
  `docs/architecture.md` (or new section).

## Capabilities

### New Capabilities

- `create-spec-handler`: end-to-end spec-PR creation. Defines the
  handler's contract, the agent / bot work split, the workdir
  lifecycle, the precondition checks, the failure-comment contract,
  and the metadata-block format produced on the spec PR body.

### Modified Capabilities

- `agent-runtime`: documents that handlers MAY ignore the agent's
  reply and consume side-effects from the cwd instead, and that
  Bash + file tools are allowed inside agent invocations without
  restriction (deny-listing is a later concern).
- `openspec-flow`: the `create-spec` beat is now real end-to-end —
  no longer "stub posts a comment", but "bot opens a spec PR
  linked back to the issue".

## Impact

- New files: `src/handlers/create-spec/clone.ts`,
  `src/handlers/create-spec/git.ts`,
  `src/handlers/create-spec/pr.ts`,
  associated `*.test.ts` files. Updated
  `src/handlers/create-spec/prompt.md` (narrowed).
- Modified: `src/handlers/create-spec/index.ts` (orchestration);
  `src/index.ts` dispatcher passes `octokit` and issue body to the
  handler; `src/cli.ts` builds Octokit from `gh auth token` for CLI
  mode.
- New deps: none. `execa` is candidate for `git` shell-outs but
  Node 22 `node:child_process.execFileSync` is enough.
- Cost per `create-spec`: one Claude session that drafts a few KB
  of markdown. Cents.

## Out of scope

- `iterate-spec`, `iterate-impl`, `create-impl` handlers.
- Skipping the clone when `GITHUB_WORKSPACE` is set (Action mode
  optimisation). Recorded in `ideas.md`.
- Configurable `runAgent` `allowedTools` shape. Recorded in
  `ideas.md`.
- Bash deny-list hook (prevent `git`/`gh` even if prompted).
  Recorded in `ideas.md`.
- Automatic `openspec init` if the skill is missing from the
  target repo — we just fail fast and tell the user to install.
- Multi-PR-per-issue flows (one issue could spawn multiple
  changes). Out of scope for this beat; the precondition allows
  multiple changes to land, but the bot still opens exactly one
  PR carrying them all this round.
- Backoff / retry on transient git / Octokit failures — fail
  fast, surface the error, let the user re-trigger with
  `openspec:go`.
