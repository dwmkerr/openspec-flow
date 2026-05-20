# Design — wire-create-impl-handler

## Architecture mirror

The handler mirrors `create-spec` exactly, swapping spec ⟶ impl
throughout. The agent's job is implementation + verification +
archive; the bot's job is git mechanics + PR open + comment.

```
                                cloned target repo at workdir
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
   ┌────┴───────┐                ┌─────┴───────┐               ┌──────┴──────┐
   │ Precondit  │                │  Agent      │               │   Bot       │
   │ ions       │                │ (Claude)    │               │ (handler)   │
   ├────────────┤                ├─────────────┤               ├─────────────┤
   │ openspec   │                │ apply-change│               │ branch,     │
   │ CLI + 3    │      ──►       │ verify-     │      ──►      │ commit,     │
   │ skills     │                │ change      │               │ push, PR,   │
   │ present    │                │ archive --yes│              │ comment     │
   └────────────┘                └─────────────┘               └─────────────┘
```

## Sequential mode (default)

Triggered by the classifier on `pull_request.closed` + `merged: true`
+ PR carrying `openspec:spec`. Dispatcher calls
`handleCreateImpl({ specPrNumber, ... })`.

Flow:
1. `workdir = $OPENSPEC_FLOW_WORKDIR/impl-<issue-N>-<unix-ts>`
2. `git clone --depth 50 <repo> workdir` — default branch (main)
   now contains the merged spec.
3. `git config user.{name,email}` to bot identity.
4. Read spec PR body via Octokit; parse metadata block for `issue`
   and `change` fields.
5. Preconditions: `openspec --version` runs; all three skills
   (`openspec-apply-change`, `openspec-verify-change`,
   `openspec-archive-change`) present under
   `workdir/.claude/skills/`. (Archive skill not actually used by
   our prompt — we shell out to `openspec archive --yes` — but the
   target repo should have it for human consistency.)
6. Render prompt with `{{changeName}}` and `{{repo}}`.
7. `runAgent({ prompt, cwd: workdir, log, env: { GH_TOKEN }, options: { permissionMode: "bypassPermissions" } })`.
8. Verify the workdir state changed sensibly:
   - `openspec/changes/<name>/` should be **gone** (archive moves it).
   - `openspec/changes/archive/*-<name>/` should exist.
   - `git status --porcelain` should be non-empty (code changed).
9. Derive branch `feat/<n>-<slug>` (slug already deterministic
   from issue title — reuse `slug.ts`).
10. `git checkout -B <branch>` (force-overwrite local if exists).
11. `git add -A`.
12. `git commit -m "feat: <issueTitle>"`.
13. `git push --force-with-lease -u origin <branch>`.
14. `octokit.pulls.create({ base: "main", head: branch, ... })`.
15. `octokit.issues.addLabels({ labels: ["openspec:impl"] })`.
16. Comment on the originating issue (`issue` from metadata block):
    `impl PR opened: #M`.
17. Cleanup workdir.

## Chained mode (opt-in)

Triggered when `OPENSPEC_FLOW_CHAINED_MODE=true` AND a `create-spec`
handler invocation just opened a spec PR. The spec handler calls
`handleCreateImpl` directly at the end, passing the spec PR number
and spec branch name (no webhook event involved).

Differences from sequential:

| Step | Sequential | Chained |
|---|---|---|
| Workdir base | clone fresh (default branch = main with spec merged) | clone fresh, then `git checkout <specBranch>` (so the workdir has the spec changes ready) |
| Impl branch base | `feat/<n>-<slug>` off main | `feat/<n>-<slug>` off `<specBranch>` |
| PR `base` field | `main` | `<specBranch>` (e.g. `chore/<n>-<slug>`) |
| Change name | parsed from spec PR body metadata | passed in directly from spec handler |
| Failure surface | comment on originating issue | comment on originating issue AND, if impl PR exists, on the impl PR |

GitHub's stacked-PR behaviour does the rest: when the spec PR
later merges to main, GitHub retargets the impl PR's `base` to
main and filters out the now-merged commits from the impl diff.
We don't have to do anything for that transition.

## Mode detection inside the handler

`handleCreateImpl` takes an explicit `mode` param so callers are
unambiguous:

```ts
interface HandleCreateImplOpts {
  owner: string;
  repo: string;
  specPrNumber: number;        // canonical reference
  specBranch?: string;         // required for chained
  changeName?: string;         // required for chained; sequential parses from spec PR body
  issueNumber?: number;        // required for chained; sequential parses from spec PR body
  mode: "sequential" | "chained";
  octokit: MinimalOctokit;
  gitPushToken: string;
  log: RunAgentLogger;
  runner?: typeof runAgent;
}
```

Sequential path fetches spec PR via Octokit + parses metadata
block. Chained path trusts the spec handler's already-known
context. Cleaner than auto-detecting state mid-handler.

## Spec PR body metadata parser

New file `src/handlers/shared/spec-pr-metadata.ts`:

```ts
interface SpecPrMetadata {
  issue: number;
  change: string;
  kind: "spec";
}

const parseSpecPrMetadata = (body: string): SpecPrMetadata | null
```

Parses the HTML comment block format defined in `CLAUDE.md`:

```
<!-- openspec-flow:auto-maintained — do not remove or edit
issue: 42
kind: spec
change: add-csv-export
-->
```

Used by `create-impl` sequential mode. Future iterate handlers
will reuse it.

## Chained-mode hook inside create-spec

At the end of `handleCreateSpec`, after the success comment on the
issue:

```ts
if (process.env.OPENSPEC_FLOW_CHAINED_MODE?.toLowerCase() === "true") {
  opts.log.info("create-spec: chained mode — invoking create-impl");
  await handleCreateImpl({
    owner, repo,
    specPrNumber: pr.data.number,
    specBranch: branch,
    changeName,
    issueNumber: opts.issueNumber,
    mode: "chained",
    octokit, gitPushToken, log: opts.log,
  });
}
```

Wrapped in its own try/catch so a chained-mode impl failure doesn't
roll back the (successful) spec PR.

## PR body template (impl)

```
<short summary from first non-heading paragraph of proposal.md>

Closes #{{issueNumber}}.

<!-- openspec-flow:auto-maintained — do not remove or edit
issue: {{issueNumber}}
kind: impl
change: {{changeName}}
spec-pr: {{specPrNumber}}
-->
```

`Closes #N` makes the originating issue auto-close on impl PR
merge — per the existing `CLAUDE.md` flow.

## Failure handling (option A)

Single try/catch at the handler boundary:

| Failure point | Behaviour |
|---|---|
| Clone / preconditions / metadata-parse | comment on issue, throw |
| Agent error | comment on issue, throw |
| Workdir verification fails (no archive dir, no diff) | comment on issue, throw |
| `git push` fails | comment on issue, throw |
| PR open fails (e.g. base branch gone) | comment on issue, throw |
| Label / issue-comment fails AFTER PR opens | swallow (PR is the substantive artefact); log warn |

If the impl PR is already open when an error occurs (e.g. push
succeeded but `pulls.create` failed because a PR was already there),
the comment goes on both the issue and the impl PR. Operator can
push manual fixes to the existing branch.

## Why a separate handler vs sharing with create-spec

Tempting to factor a generic `runAgentHandler(opts)` that both
spec and impl use. Don't yet — they differ on:

- Skill set invoked (`openspec-new-change` vs `openspec-apply-change`
  + `openspec-verify-change`)
- Workdir setup (clone main vs clone main + checkout spec branch)
- PR base, branch prefix, label, metadata block fields
- Verification heuristics (spec → "did any change get created" vs
  impl → "did the change get archived")

Sharing the helpers (`slug`, `workdir`, `git`, `preconditions`,
`changes`, `pr`) is enough. The orchestration code is short; a
shared abstraction would cost more in indirection than it saves.

## Edge cases

| Scenario | Behaviour |
|---|---|
| Spec PR iterated (force-push on chore/) before impl runs | Sequential mode unaffected (re-runs on next merge). Chained mode: stale state in impl PR — defer fix to ideas.md. |
| Spec PR closed unmerged | Sequential mode: no `create-impl` event ever fires. Chained mode: GitHub closes the stacked impl PR; bot doesn't intervene. |
| Re-triggering impl on a PR that already exists | `gh pr list --head feat/<n>-<slug>` → if present, update existing PR's body rather than open new one. |
| Verify reports CRITICAL forever (apply loop) | Agent's own turn budget bails out. Handler catches throw, posts failure comment. |
| Archive command fails | Agent's reply includes the error; handler's workdir verification catches the missing `archive/<...>` dir and fails. Failure comment surfaces. |
