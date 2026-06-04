# Design: app-install-init-pr

## Context

The App today is a thin Probot adapter that converts webhook `Context` into `DispatchDeps` and invokes `runDispatch` — the same core the Action-mode CLI calls. That duplication is fine for shared event handling but it has hidden two real gaps:

1. **The App does nothing on install.** A fresh repo with the App attached looks identical to a repo without it until the user manually runs `openspec-flow install`. The flow's value proposition for App users (zero-touch) is unrealised.
2. **Both adapters can fire for the same event.** If a repo has the shim merged AND the App installed, an `issues.labeled` webhook is processed by Probot in-proc while the shim workflow runs the same intent in the runner. Two PRs, two comments, two labels removed and re-added.

`runDispatch` is the right convergence point; the question is upstream of it. This change formalises:

- **`installation.created` is the App's distinct job.** Only Probot can see this event. The handler scaffolds the shim + README regions in the user's repo via the GitHub API so the App user gets the Action-mode plumbing without leaving GitHub.
- **In-proc event dispatch is dev-only.** Production App installs hand all event work to the shim. The env flag `OPENSPEC_FLOW_DISPATCH_MODE` makes the choice explicit and the dual path safe.

A third concern emerged from the proposal review: developers want to **preview** what the init PR will look like against a specific remote repo without round-tripping through a webhook. The same `runAppInit` core is exposed as `openspec-flow app-init` so a single implementation drives Probot, the CLI dry-run, and the CLI live run.

## Goals / Non-Goals

**Goals:**

- One installation event → one PR per repo in that installation, scaffolding the shim workflow + managed README regions, idempotent on re-install.
- One env flag controls whether Probot dispatches issue/PR events in-proc or no-ops them for the shim to handle. Default is the safe-for-prod choice.
- One `runAppInit` core, three entry points (webhook handler, `app-init --dry-run`, `app-init`). No second implementation.
- Local-dev parity: `app-init --dry-run --repo <owner/name>` shows exactly what the webhook handler would write, against the real remote state.

**Non-Goals:**

- Handling `installation_repositories.added` (App is added to additional repos in an existing install). Tracked in `ideas.md`; same handler can be wired later.
- Writing `OPENSPEC_FLOW_APP_ID`, `OPENSPEC_FLOW_PRIVATE_KEY`, or `ANTHROPIC_API_KEY` Actions secrets at install. Requires `secrets:write` App permission and adds an org-consent step; out of scope. Init PR body documents the manual `gh secret set` commands the user must run, mirroring CLI install today.
- Changing Action-mode runtime behaviour, the label contract, or the `intent-recognition` capability.
- Replacing or unifying the existing `install` CLI command. CLI install and App init share `src/install/templates.ts`; they remain separate user-facing commands with different audiences.

## Decisions

### D1. Dispatch-mode gating uses one env flag, not multiple

**Decision**: A single env var `OPENSPEC_FLOW_DISPATCH_MODE` with two values: `action` (default) and `in-process`. Probot's `issues` and `pull_request` handlers no-op unless the value is `in-process`. The `installation.created` handler ignores the flag (App-only event).

**Alternatives considered**:
- Per-event flags (`OPENSPEC_FLOW_PROBOT_ISSUES=true`, …). Rejected — explodes config surface, easy to leave one set.
- Repo allowlist (`OPENSPEC_FLOW_DEV_REPOS=owner/a,owner/b`). Rejected — two configs to keep in sync with the App's installation list; a repo can drift in or out without local config knowing.
- A marker file in the user repo (`.openspec-flow/dispatch=action`) the shim reads. Rejected — clutters user repo, brittle if the file is deleted, no help when both paths exist before the file is committed.

**Why this**: a single boolean-shaped flag, defaulted to the prod-safe path, with a startup log line is the minimum mechanism that prevents double-fire. The cost is ~one line per gated handler.

### D2. `installation.created` handler ignores the dispatch flag

**Decision**: Install bootstrapping always runs in Probot regardless of `DISPATCH_MODE`. The flag only gates issue/PR handlers.

**Why**: Only Probot ever receives install events; there is no competing Action-mode path to deconflict with. Gating it would silently break onboarding when a developer flips to `action` mode.

### D3. `runAppInit(deps, repo, opts)` is the shared core

**Decision**: All three entry points (webhook, CLI dry-run, CLI live) call:

```ts
runAppInit(
  deps: { octokit, log },
  repo: { owner: string, name: string, defaultBranch: string },
  opts: { dryRun: boolean }
): Promise<AppInitResult>
```

`AppInitResult` is a structured plan with: files to write (path, content, mode), branch name, PR title/body, and a `skipped` flag with a reason when the repo is already initialised. The webhook adapter constructs `deps` from Probot's `Context`. The CLI adapter constructs `deps` from `@octokit/rest` plus a token from `--token` or `gh auth token`.

**Alternatives considered**:
- Two implementations sharing only template renderers. Rejected — idempotency logic and PR body rendering will drift.
- A side-effect-only function that returns void. Rejected — `--dry-run` needs to print the plan; tests need to assert it without a network.

**Why**: Plan-first separates "what would change" from "do it", lets `--dry-run` reuse 100% of the planner, and gives tests a structured object to assert against instead of mock API calls.

### D4. Idempotency check is "both README markers present AND workflow file exists"

**Decision**: Before opening a PR, fetch `README.md` and `.github/workflows/openspec-flow.yml` from the default branch. Skip with `skipped: "already-initialised"` when:
- README contains both `<!-- openspec-flow badge-start -->` and `<!-- openspec-flow install-start -->` markers, AND
- the workflow file exists.

Also skip with `skipped: "pr-already-open"` if an open PR from head `chore/openspec-flow-init` already exists.

**Alternatives considered**:
- Marker on the repo (`.openspec-flow/installed`). Rejected — adds an artefact the CLI install doesn't write; install and app-init would diverge.
- Always open a PR; let the user close it. Rejected — noisy on re-install (e.g. App reinstalled after uninstall).
- Compare file content byte-for-byte. Rejected — content drifts legitimately (user edits README between markers, workflow ref bumps); marker presence is the contract.

**Why**: marker presence is already the install/uninstall contract (CLAUDE.md § Install modes). Reusing it keeps one source of truth.

### D5. Init PR uses no lifecycle label

**Decision**: The PR carries no `openspec:*` label. The label contract stays exactly three labels (`openspec:go`, `openspec:spec`, `openspec:impl`).

**Alternatives considered**:
- New `openspec:init` label. Rejected — adds a fourth label that the user contract doesn't need; install PRs are recognised by their title and managed branch, not by needing to slot into the `go → spec → impl` flow.

**Why**: simpler contract; the init PR is a one-off scaffold, not part of the recurring loop.

### D6. CLI `app-init` is live-by-default; `--dry-run` is the opt-in preview

**Decision**: `openspec-flow app-init` opens the PR by default. `--dry-run` is an opt-in flag that short-circuits the writer and prints the plan.

**Alternatives considered**:
- Dry-run by default with `--no-dry-run` to opt in. Initial draft of this design. Rejected after first-user feedback — `openspec-flow install` opens its writes by default; making the App-side CLI silent-by-default broke the user's expectation that a no-flag invocation does something.

**Why**: matches `install`'s act-by-default semantics, so the two scaffolders behave the same way and there's one mental model. Idempotency keeps re-runs safe (skip-on-markers, skip-on-open-PR), so "live by default" is not destructive on subsequent invocations.

### D7. CLI command is `openspec-flow app-init`, not subsumed into `install`

**Decision**: New top-level command `app-init` alongside the existing `install`, `uninstall`, `dispatch`, `handle`.

**Alternatives considered**:
- Extend `install` with `--remote owner/name`. Rejected — `install` operates on cwd today; remote install is a different mental model (no local checkout, no local writes).
- Hide it under `dispatch` or `handle`. Rejected — those are CI plumbing; `app-init` is dev-facing.

**Why**: distinct verb, distinct audience (App devs, sandbox testers), discoverable via `--help`.

### D8. Token resolution order for the CLI: `--token` → `GITHUB_TOKEN` → `gh auth token`

**Decision**: `app-init` resolves the auth token in this order. If none are present, exit non-zero with a clear message.

**Why**: `--token` for explicit App-token testing, `GITHUB_TOKEN` for CI smoke tests, `gh auth token` for the common dev case where the user is already authed.

## Risks / Trade-offs

- **Risk**: Developer leaves `OPENSPEC_FLOW_DISPATCH_MODE=in-process` set in a hosted Probot deployment. Both paths fire on every event in any repo with the shim merged. → **Mitigation**: boot-time log line surfaces the mode; smoke test asserts gating; hosted deployment template defaults to unset (i.e. `action`).
- **Risk**: User merges init PR before adding the `ANTHROPIC_API_KEY` secret. Workflow runs and fails on first `openspec:go`. → **Mitigation**: PR body leads with the `gh secret set` command and explains the consequence; tracked separately by the `install` CLI's existing secret-state reporting (which the App handler can mirror in the PR body).
- **Risk**: GitHub Contents API rate-limit on bulk init across a large org install (one PR per repo, several file reads each). → **Mitigation**: process repos serially per installation, surface 403 rate-limit responses in logs, retry with backoff on the per-repo call only.
- **Trade-off**: `runAppInit` returning a plan object means the webhook handler now allocates and discards a plan on every install event even when no changes are needed. Memory cost is trivial; the architectural win (CLI dry-run reuse) is worth it.
- **Trade-off**: not auto-setting Actions secrets means the App's "zero-touch" promise stops at "PR opened, manual secret setup remains". Acceptable for v1; the gap is a single documented command, not a workflow.
- **Trade-off**: idempotency relies on markers. A user who deletes the markers but keeps the content will get a duplicate init PR. Acceptable — they explicitly removed the contract.

## Migration Plan

1. **Land code behind the flag.** Ship `OPENSPEC_FLOW_DISPATCH_MODE` defaulting to `action`. Existing local dev breaks until a developer sets `in-process`. Document this in `docs/developer-guide.md`.
2. **Ship `installation.created` handler.** Idempotency means re-installing the App on existing repos doesn't open spurious PRs.
3. **Ship CLI `app-init`.** Independent of webhook; usable immediately for previewing.
4. **Update `CLAUDE.md` § Install modes** to describe the dispatch flag and the App-mode init PR.
5. **Rollback**: revert the change set. The shim and `install` CLI are unchanged, so user-side state is unaffected. App installs that already received an init PR keep their state; uninstalling the App + running `openspec-flow uninstall` cleans both regions.

## Open Questions

- **Q1**: Should the init PR body include the App's GitHub App ID and a link to the App's setup page so the user can verify which App opened the PR? Leaning yes for dev installs (`openspec-flow-dev-<name>`) where ambiguity is real; less critical in prod.
- **Q2**: When `--dry-run` runs against a repo where the markers are present, should it still print the rendered template (informational) or just print `skipped: already-initialised`? Leaning the latter for symmetry with the live path's behaviour.
- **Q3**: The `app-init` CLI requires GitHub API access — should it surface a clear error when run in an offline / no-token environment, or should we add a `--from-fixture` mode that reads a local README/workflow snapshot? Defer to follow-up unless testing exposes a need.
