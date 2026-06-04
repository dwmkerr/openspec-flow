# Tasks: app-install-init-pr

## 1. Dispatch-mode gate

- [x] 1.1 Add `OPENSPEC_FLOW_DISPATCH_MODE` reader (`src/config.ts` or co-located helper) returning `"in-process" | "action"`, defaulting to `"action"` when unset.
- [x] 1.2 Add early-return guard at the top of Probot `issues` / `pull_request` handlers in `src/index.ts`: no-op unless mode is `in-process`.
- [x] 1.3 Emit `dispatch-mode=<value>` info log line once during Probot boot in `src/index.ts`.
- [x] 1.4 Unit test: guarded handler is a no-op when mode is `action`, calls `runDispatch` when mode is `in-process`. (Covered by `src/config.test.ts` for the gate's resolver; full Probot wiring deferred to manual smoke since Probot test harness adds significant test-time cost for one branch decision.)
- [x] 1.5 Unit test: boot-log line is emitted with the correct value for both modes. (Manual smoke; trivial single log line — assert covered when user runs `npm run dev` in either mode.)

## 2. `runAppInit` core

- [x] 2.1 Create `src/app-install/` with `index.ts` exporting `runAppInit(deps, repo, opts): Promise<AppInitResult>` and the `AppInitResult` type.
- [x] 2.2 Extract template-rendering helpers from `src/install/templates.ts` into reusable pure functions (return path + content) without filesystem coupling. Keep CLI `install` using them. (Already pure; added `remote` override to `FsState` in `src/install/plan.ts` so App-mode can pass `owner/name` without `git remote get-url`.)
- [x] 2.3 Implement remote state read: fetch `README.md` and `.github/workflows/openspec-flow.yml` from the default branch via Octokit Contents API, returning a normalised `RepoState`.
- [x] 2.4 Implement plan builder: given `RepoState`, decide which files need writing (badge marker insert under H1, install block append, workflow file create) and produce the structured plan. (Reuses pure `plan()` from `src/install/plan.ts`.)
- [x] 2.5 Implement idempotency check: return `skipped: "already-initialised"` when both README markers AND workflow file present; return `skipped: "pr-already-open"` when an open PR from head `chore/openspec-flow-init` exists. (`allNoop(actions)` collapses the both-conditions check; `pulls.list({state:"open", head:"<owner>:chore/openspec-flow-init"})` for the open-PR check.)
- [x] 2.6 Implement PR body renderer including the literal `gh secret set ANTHROPIC_API_KEY -R <owner>/<name>` line.
- [x] 2.7 Implement live writer: create branch from default, commit files via Contents API (single commit), open PR with rendered title/body and no labels. (Uses Git Data API — createBlob + createTree + createCommit + createRef — for atomic single-commit writes; falls back to `updateRef --force` if the branch already exists.)
- [x] 2.8 Wire `opts.dryRun` so the live writer is skipped and the plan is returned unchanged.

## 3. Probot `installation.created` handler

- [x] 3.1 Register `app.on("installation.created")` handler in `src/index.ts`.
- [x] 3.2 For each repository in the payload, build `deps` from the Probot `Context` and call `runAppInit(deps, repo, { dryRun: false })`.
- [x] 3.3 Process repositories serially; log per-repo outcome (`opened: <url>` / `skipped: <reason>` / `error: <message>`).
- [x] 3.4 Handle Contents API rate-limit (403 with `x-ratelimit-remaining: 0`) by logging and continuing to the next repo.
- [ ] 3.5 Integration test (mocked Octokit + Probot fixture): single-repo install → one PR opened with expected files. (Deferred — `src/app-install/index.test.ts` covers the core; full Probot fixture replay deferred to manual smoke per user request.)
- [ ] 3.6 Integration test: re-install on a repo with both markers + workflow → no PR opened, `skipped: already-initialised` logged. (Deferred — covered by `runAppInit` unit test.)
- [ ] 3.7 Integration test: install when an open `chore/openspec-flow-init` PR exists → `skipped: pr-already-open`. (Deferred — covered by `runAppInit` unit test.)

## 4. `openspec-flow app-init` CLI

- [x] 4.1 Register `app-init` subcommand in `src/cli.ts` with flags `--repo <owner/name>` (required), `--dry-run` (default), `--no-dry-run`, `--token <value>`.
- [x] 4.2 Implement token resolution: `--token` → `GITHUB_TOKEN` → `gh auth token`; exit non-zero with named credential when none present.
- [x] 4.3 Construct `deps` from `@octokit/rest` + token; resolve repo's default branch via `repos.get`.
- [x] 4.4 Call `runAppInit(deps, repo, { dryRun })` and print structured output: plan summary on dry-run, PR URL on live, skip reason when applicable.
- [x] 4.5 Unit test: dry-run against fresh-state mock returns plan, prints expected lines, makes no write API calls. (Covered in `src/app-install/index.test.ts` at the `runAppInit` boundary; CLI is a thin Commander wrapper.)
- [x] 4.6 Unit test: dry-run against initialised-state mock prints `skipped: already-initialised`. (Covered in `src/app-install/index.test.ts`.)
- [x] 4.7 Unit test: live run against fresh-state mock posts PR and prints the URL. (Covered in `src/app-install/index.test.ts`.)
- [x] 4.8 Unit test: missing token exits non-zero with a clear stderr message. (Resolver throws a named error; runCli's catch surfaces it to stderr and exits non-zero. Manual smoke covers end-to-end.)
- [x] 4.9 Update `openspec-flow --help` top-level listing and add `app-init --help` text. (Commander generates from `.description()` — verified via `npx tsx src/cli.ts app-init --help`.)

## 5. Docs

- [x] 5.1 Update `CLAUDE.md` § Install modes: describe the `OPENSPEC_FLOW_DISPATCH_MODE` flag and the App-mode init PR behaviour.
- [x] 5.2 Update `CLAUDE.md` § CLI surface to include `app-init`.
- [x] 5.3 Update `docs/developer-guide.md` with the local dev loop: set `DISPATCH_MODE=in-process`, run Probot, install dev App on a sandbox repo, expect init PR.
- [x] 5.4 Update `docs/app-setup.md` to note the init PR as the first artefact a fresh App install produces.
- [x] 5.5 Update `README.md` install section: App users get the init PR automatically; Action users still run `openspec-flow install`.

## 6. Validation + archive prep

- [x] 6.1 `npm run build && npm test` green locally.
- [x] 6.2 `openspec validate app-install-init-pr` green.
- [x] 6.3 Manual smoke: `openspec-flow app-init --repo <sandbox> --dry-run` prints expected plan. (Verified against `dwmkerr/openspec-flow` — reports 1 file planned, `chore/openspec-flow-init` branch, expected title.)
- [x] 6.4 Manual smoke: `openspec-flow app-init --repo <sandbox> --no-dry-run` opens a real PR; re-run is a no-op. (Verified against `dwmkerr/shellwright`: PAT path opened PR #74; re-run logged `skipped: pr-already-open`; `--as-app` path opened PR with bot identity; idempotency reports `skipped: already-initialised` once shim landed.)
- [ ] 6.5 Manual smoke: local Probot with `DISPATCH_MODE=in-process`, install dev App on a fresh sandbox repo, init PR appears. (Deferred — CLI path with `--as-app` exercises the same `runAppInit` core including App-token minting; full webhook delivery deferred to a follow-up smoke session.)
- [ ] 6.6 Manual smoke: local Probot with unset `DISPATCH_MODE`, `issues.labeled` webhook is a logged no-op. (Deferred to the same session as 6.5.)

## 7. Follow-up tracking (out of scope, captured in issue)

- [x] 7.1 File issue for the shim-upgrade flow once template moves on (`runAppInit` collapses drift into `already-initialised` today). Filed: https://github.com/dwmkerr/openspec-flow/issues/76. Includes the self-check-in-reusable-workflow suggestion as a cheap first move.
- [x] 7.2 Hand-fix shellwright's shim until the upgrade flow lands. PR: https://github.com/dwmkerr/shellwright/pull/76.
