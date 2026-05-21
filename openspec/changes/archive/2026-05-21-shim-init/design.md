## Context

The `rfc-shim-architecture` change established a shim-first install model. The shim file `.github/workflows/openspec-flow.yml` is what makes a repo into an openspec-flow target. Today there is no tool to write it — every install is hand-rolled, and the contract between shim version and the published reusable workflow drifts immediately.

This design covers the **thinnest writer** of the shim plus two adjacent artefacts (`.openspec-flow.yaml`, a README block). It is deliberately not a complete install experience — auto-PR (#46), IDE skills (#47), OpenSpec bootstrap (#48), schema (#49), banner (#50), and `act` (#51) are all separate slices.

## Goals / Non-Goals

**Goals:**

- Single command `npx @dwmkerr/openspec-flow init` writes the shim, the config stub, and a managed README block.
- Idempotent: re-running on an already-initialised repo prints "already initialised" and exits 0 with no file changes. Hand-edited content outside the managed block survives `--force`.
- Non-interactive path under CI (`--yes`).
- Same TUI stack across `init` and any future subcommand (`status`, `doctor`, `update`), so the CLI feels coherent rather than command-by-command.
- Read-only secret reporting via `gh` when available — surfaces missing secrets up front without ever writing them.
- Zero network calls in this slice. No App, no GitHub API beyond `gh secret list`.

**Non-Goals:**

- Opening a PR. The user pushes the branch and opens the PR themselves in this slice (#46 adds the auto-PR path).
- Bootstrapping OpenSpec. `init` assumes `openspec/` is already present, or prints a hint and exits 0 if it isn't (#48 adds the auto-invoke).
- Writing or rotating any secret value.
- Schema-validating `.openspec-flow.yaml` (#49). The file is a commented stub only.
- Generating IDE skills or slash commands (#47).
- Animated welcome banner (#50). This slice uses a single-line bordered title.

## Decisions

### Decision 1: TUI stack — match the OpenSpec CLI choice

Adopt: `commander@14` + `@inquirer/prompts@7` + `@inquirer/core@10` + `chalk@5` + `ora@8`.

Rationale: this stack is the *de facto* modern-Node CLI baseline (used by `@fission-ai/openspec` itself, and by hundreds of public CLIs). Hooks-style `@inquirer/core` lets us build any bespoke prompt we need later without bringing in a UI framework. ESM-only across the board, which matches our Node-16-style import strategy.

Alternatives considered:

- **Ink / React.** Too heavy for a single-shot install command. Useful when the CLI runs a long-lived dashboard; this CLI exits in <2s.
- **`@clack/prompts`.** Cleaner default visuals but smaller ecosystem; harder to drop in custom prompts when we get to #47 (IDE multi-select with detected pre-selection).
- **`prompts` / `enquirer`.** Functional but no equivalent of inquirer's `createPrompt` hooks API.

### Decision 2: Binary name and command shape

Binary: `openspec-flow`. Subcommands now and later:

```
openspec-flow init [--yes] [--force] [--no-secrets-check] [--path <dir>]
openspec-flow --version
openspec-flow --help
```

Rationale: distinct from `openspec` (Fission's CLI) to avoid collision when both are installed. Subcommand pattern leaves room for `status`, `doctor`, `update` without a second binary.

Alternatives considered: a single-purpose `openspec-flow-init` binary — rejected because we know other subcommands are coming (the issue tree already names them), and switching to subcommands later would be a breaking rename.

### Decision 3: Managed-block markers in `README.md`

The README block is patched between **HTML-comment markers**:

```html
<!-- openspec-flow:install-start -->
…managed content…
<!-- openspec-flow:install-end -->
```

Rationale: HTML comments render invisibly in GitHub-flavoured Markdown, are machine-readable, and survive copy-paste. Same pattern as our existing PR-body metadata block (`<!-- openspec-flow:auto-maintained …`). Future drift detector and the `init --force` path both rely on the marker pair.

On first run with no markers present: append the block at end of `README.md`. If no `README.md` exists, create it with a minimal h1.

On re-run with markers present: replace content **between** the markers; never touch content outside them.

On re-run when the user has deleted the markers (and presumably hand-rewritten the section): treat as "user took over". `init` warns, leaves the README alone, and exits 0. `--force` re-appends a fresh block at the end.

Alternatives considered:

- **Whole-file overwrite.** Rejected — users put project-specific content in their README; we cannot own it.
- **Diff-and-prompt.** Rejected for the thin slice; adds prompt complexity for a low-value case. Revisit if users complain.

### Decision 4: Shim file content is a string template, not a YAML AST

The shim file is rendered from a single template literal in `src/cli/templates/workflow.yml.ts`. The `@vN` ref is the only interpolated variable; the rest is verbatim.

Rationale: the shim YAML is small (~25 lines) and never read back by `init` for parsing. A YAML AST library buys nothing here and risks reformatting cleanly-aligned comments. Drift detector (deferred) parses only the `uses:` line — regex-on-known-template is appropriate at that point too.

### Decision 5: Idempotency check — content hash, not file presence

On re-run, `init` compares the current file contents against the rendered template for the *same* version. Outcomes:

| State | Action |
|---|---|
| File matches current template | no-op, print "already initialised" |
| File matches an older template version | no-op without `--force`; `--force` rewrites to current |
| File diverges from any known template (hand-edited) | no-op + warning; `--force` overwrites |
| File missing | write |

Known-template hashes are committed under `src/cli/templates/known-hashes.ts`. Each release that changes the template appends a hash.

Rationale: file-presence is too coarse — a stale-pinned shim is functionally broken. Hand-edit detection avoids clobbering users who tweak the workflow (e.g. add a custom runner).

### Decision 6: Secret-state reporting is best-effort + advisory

When `gh` is on PATH and the working directory resolves to a GitHub remote, `init` runs `gh secret list -R <owner>/<repo> --json name` and reports presence for the three known names. When `gh` is absent or the repo has no GitHub remote, `init` prints a static checklist and continues.

`init` never fails on missing secrets in the thin slice. Reasoning: `init` is run pre-merge; secrets can be added on the GitHub settings page before the user merges the setup PR. Failing here would block local scaffolding for a runtime concern.

Alternative considered: `init --strict` that fails on missing secrets. Useful for CI smoke tests. Filed as a follow-up under #46.

### Decision 7: TTY and `--yes` semantics

- `process.stdout.isTTY === true` and no `--yes`: interactive prompts (confirm overwrite, confirm README patch).
- `--yes`: no prompts, all defaults accepted, **no `--force` semantics granted** (idempotency rules still apply; hand-edits still preserved).
- Non-TTY without `--yes`: exit 2 with `error: refusing to run non-interactively without --yes`.

Rationale: same gate `@fission-ai/openspec` uses. Matches user expectation that `npx … init --yes` in CI just works, while preserving "do nothing surprising" for an interactive shell.

### Decision 8: Bundle as ESM, ship as a single file

`src/cli/` is built into `dist/cli/openspec-flow.js` via the existing TypeScript build. `bin/openspec-flow.js` is a one-line shebang shim that re-exports. No bundling tool needed initially; if startup time becomes a concern (>500ms), revisit `esbuild --bundle`.

Rationale: keep the build identical to `src/handlers/`. Two binaries (`bin/openspec-flow.js` and the existing reusable-workflow entry) share `dist/`.

## Risks / Trade-offs

- **[Risk] `gh` not installed → user thinks `init` is broken.** → Detect `gh` once at startup; emit `gh not found — skipping secret check (install: https://cli.github.com)`. Continue.
- **[Risk] User has a non-trivial existing `.github/workflows/openspec-flow.yml` that does more than `uses:`.** → Hash-mismatch path: warn + no-op without `--force`. Document the marker-based approach as the supported customisation surface only on `README.md`; the workflow file itself is fully managed.
- **[Risk] Template version pinning gets stale fast.** → Drift detector (deferred per RFC). Until then, the user can re-run `init --force` to bump.
- **[Risk] `npx` cold-start is slow.** → Acceptable; `init` is run once or twice per repo. If feedback says otherwise, ship a single bundled file (Decision 8 escape hatch).
- **[Trade-off] No animated banner means the CLI feels plain.** → Acceptable for the thin slice; #50 ships the banner. The single-line title still uses the project palette.
- **[Trade-off] No auto-PR means an extra step for the user.** → Acceptable; the stdout instructions are explicit and copy-pasteable. #46 closes the gap with App-token-minted PRs.
- **[Trade-off] No OpenSpec bootstrap means a confused user if they run `init` before `openspec init`.** → `init` detects absent `openspec/` and prints a one-line hint pointing at `npx @fission-ai/openspec init`. No hard failure. #48 adds the auto-invoke.

## Migration Plan

This slice introduces a new CLI. Nothing existing breaks. Rollback = revert the change; the published package can be unpublished or marked deprecated within npm's 72-hour window.

Release cadence: ships under `@dwmkerr/openspec-flow@0.3.0`. Reusable workflow tag `v0.3.0` published from the same commit so the shim's `@v0.3.0` pin resolves immediately.

## Open Questions

1. **Where does the README block live by default — top or bottom?** Lean append-at-end on first run; users move it. Open to feedback.
2. **Should `--path` accept a remote URL (clone-then-init)?** Not in this slice. Track if asked for.
3. **Do we ship completion scripts (`openspec-flow completion bash|zsh`)?** Mirrors OpenSpec CLI. Deferred — add when a second subcommand exists.
4. **Telemetry?** OpenSpec CLI uses Posthog. Different trust contract for a workflow-installer; default off, opt-in only, and only after we have something worth measuring. Out of scope.
