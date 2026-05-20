## Why

We have create-spec working end-to-end. The next beat closes the
loop: when a spec PR merges, the bot opens the corresponding impl
PR. The handler mirrors create-spec almost exactly — bot owns the
deterministic mechanics, agent does the implementation work via the
`openspec-apply-change` + `openspec-verify-change` skills.

We also want a **chained mode** for development: after the spec PR
opens, immediately open the impl PR on top of the spec branch. Lets
us watch the whole chain run without merging spec first. Production
stays sequential (one merge gate between spec and impl); dev gets
the fast end-to-end loop.

## What Changes

- **Real `handleCreateImpl`** mirrors `handleCreateSpec` shape:
  clone, preconditions, agent invocation, then bot mechanics
  (branch, commit, push, open PR, comment).
- **Sequential mode (default)**: dispatcher routes the `create-impl`
  intent (already classified for `pull_request.closed` + `merged:
  true` + `openspec:spec`). Handler clones at `main` (which now
  contains the merged spec), branches `feat/<n>-<slug>`, runs the
  agent, opens an impl PR with `base: main`.
- **Chained mode (opt-in, `OPENSPEC_FLOW_CHAINED_MODE=true`)**: at
  the end of `handleCreateSpec`, before returning, the spec
  handler invokes `handleCreateImpl` directly with the open spec
  PR number and branch. The impl handler detects the spec PR is
  still open, clones with the spec branch checked out, branches
  `feat/<n>-<slug>` off it, runs the agent, opens an impl PR with
  `base: chore/<n>-<slug>` (stacked PR).
- **Stacked PR works automatically**: when the spec PR later
  merges to main, GitHub retargets the impl PR's base to main and
  filters out the now-merged commits. No bot involvement needed.
- **Agent prompt** is tight, no identity preamble, no file-read
  instructions (the apply-change skill reads context itself):
  ```
  The OpenSpec change `{{changeName}}` has its spec merged on main.
  Implement it now.

  1. Use the openspec-apply-change skill with change
     `{{changeName}}` to work through tasks.
  2. When all tasks are ticked, use the openspec-verify-change
     skill. If it reports CRITICAL issues, loop back to apply.
  3. Run `openspec archive {{changeName}} --yes` in the shell.

  The surrounding harness will branch, commit, push, and open the
  impl PR. Make local changes only.
  ```
  The `--yes` flag is the documented unattended-archive escape
  hatch from the `openspec archive` CLI.
- **Change name discovery**: read the metadata HTML comment block
  in the spec PR body (per `CLAUDE.md`) — fields `issue`, `kind:
  spec`, `change: <name>`. Parsed by the handler, not the agent.
- **PR body** ends with the impl metadata block:
  ```
  <!-- openspec-flow:auto-maintained — do not remove or edit
  issue: <n>
  kind: impl
  change: <name>
  spec-pr: <spec-pr-number>
  -->
  ```
  Label: `openspec:impl`.
- **Comment on originating issue**: `impl PR opened: #M` (linked
  via `Closes #N` in the PR body for auto-close on merge).
- **Failure handling** (option A per discussion): if the agent
  fails mid-flow, the partial impl PR (if already opened) stays
  open with a failure comment pointing at the dev logs. If
  failure happens before the PR opens, single failure comment on
  the originating issue: `❌ openspec-flow couldn't open an impl
  PR: <error>`. Workdir kept on `OPENSPEC_FLOW_KEEP_WORKDIR=true`.
- **CLI subcommand**: `openspec-flow handle create-impl --pr <spec-pr> --repo <owner/repo>`.

## Capabilities

### New Capabilities

- `create-impl-handler`: end-to-end impl-PR creation. Defines the
  handler contract, the sequential / chained modes, the
  agent / bot work split, the base-branch selection logic, the
  metadata block format, and the failure-comment contract.

### Modified Capabilities

- `create-spec-handler`: spec handler now invokes the impl handler
  in chained mode after opening the spec PR. Sequential mode
  behaviour unchanged.
- `intent-recognition`: dispatcher routes the `create-impl`
  intent to the new handler.
- `openspec-flow`: the user-facing flow now opens an impl PR
  after the spec PR merges (sequential) or alongside it
  (chained). Closes the loop end-to-end.

## Impact

- New files: `src/handlers/create-impl/{index.ts,prompt.md,index.test.ts}`,
  `src/handlers/shared/spec-pr-metadata.ts` (parser for the metadata
  block in spec PR bodies; small util shared by both handlers later).
- Modified: `src/handlers/create-spec/index.ts` (chained-mode hook
  at the end), `src/index.ts` (dispatch on create-impl intent),
  `src/cli.ts` (new `handle create-impl` subcommand),
  `.env.example` (`OPENSPEC_FLOW_CHAINED_MODE`),
  `CLAUDE.md` (env var + chained mode in trigger table),
  `docs/architecture.md` (new "chained mode" section with stacked-PR
  diagram + edge cases).
- New deps: none.
- Cost: one Claude session per impl invocation. Larger than spec
  scaffolding because real code is written.

## Out of scope

- `iterate-spec`, `iterate-impl` handlers (next changes).
- Rebasing impl branch when spec branch force-pushes. Out of scope
  for now — assume spec PR is stable once opened; recorded in
  `ideas.md` if it bites.
- Per-issue label-based chained mode (`openspec:chained`). Env
  var is enough for debugging. Future change if needed.
- Automatic close of impl PR when spec PR closes unmerged.
  GitHub already closes stacked impl PRs when the base disappears.
- Configurable impl branch prefix per issue type (`feat` / `fix` /
  `perf`). Already in `ideas.md`.
- Iteration: if `verify-change` reports CRITICAL and apply loop
  exceeds N turns, the agent bails. We don't add a retry limit
  this round — the SDK's own budget is the backstop.
