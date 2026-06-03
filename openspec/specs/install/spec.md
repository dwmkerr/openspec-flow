# init Specification

## Purpose
The `openspec-flow init` command — the local scaffolder that prepares a repo for openspec-flow: writes the workflow shim, patches a managed README block, reports secret state, and surfaces the label-readiness checklist. OpenSpec scaffolding (the `openspec/` tree, AI-tool selection) is delegated to `openspec init`.
## Requirements
### Requirement: Binary and command surface

The package `@dwmkerr/openspec-flow` SHALL expose a binary named `openspec-flow` built on a hierarchical command parser. The top-level `--help` SHALL list the available commands (`install`, `uninstall`, `dispatch`, `handle`) without dumping every flag. Each command SHALL provide its own `--help`. The binary SHALL support `--version`. An unknown command or a missing required option SHALL exit non-zero with a clear message.

The user-facing commands are `install` and `uninstall`, each accepting:

- `--yes` — skip all interactive prompts; accept defaults
- `--force` — `install`: overwrite the managed README block when markers are present; `uninstall`: remove a workflow file that has diverged from the template
- `--path <dir>` — target directory (default: current working directory)

`--version` and `--help` are available at every level.

#### Scenario: install in a clean repo

- **WHEN** `openspec-flow install --yes` runs in a directory containing `openspec/` and no openspec-flow artefacts
- **THEN** the process writes `.github/workflows/openspec-flow.yml` and a managed block in `README.md`
- **AND** exits 0

#### Scenario: Top-level help lists commands

- **WHEN** `openspec-flow --help` runs
- **THEN** the output lists `install`, `uninstall`, `dispatch`, and `handle`
- **AND** exits 0

#### Scenario: Per-command help

- **WHEN** `openspec-flow install --help` runs
- **THEN** the output shows the `install` flags (`--yes`, `--force`, `--path`)
- **AND** exits 0

#### Scenario: Unknown command exits non-zero

- **WHEN** `openspec-flow bogus` runs
- **THEN** stderr names the unknown command
- **AND** exit code is non-zero

### Requirement: Workflow file write

`init` SHALL write `.github/workflows/openspec-flow.yml` containing the reusable-workflow stub defined in the `rfc-shim-architecture` change (Decision 5). The `uses:` line SHALL reference the published reusable workflow at a ref tied to the installed CLI's version.

#### Scenario: First run writes the workflow

- **WHEN** `init --yes` runs and `.github/workflows/openspec-flow.yml` does not exist
- **THEN** the file is created with the rendered workflow template

#### Scenario: Re-run on a matching workflow is a no-op

- **WHEN** `init --yes` runs and the existing workflow file is byte-identical to the current template
- **THEN** the file is not modified
- **AND** stdout includes `already initialised`
- **AND** exit code is 0

#### Scenario: Re-run on a hand-edited workflow warns and does not overwrite

- **WHEN** `init --yes` runs and the existing workflow file differs from the current template
- **THEN** the file is not modified
- **AND** stdout includes a warning naming the file
- **AND** exit code is 0

#### Scenario: Force overwrites a hand-edited workflow

- **WHEN** `init --yes --force` runs and the existing workflow file differs from the current template
- **THEN** the file is overwritten with the current template
- **AND** exit code is 0

### Requirement: README managed-block patch

`init` SHALL inject content between the marker pair `<!-- openspec-flow init-start -->` and `<!-- openspec-flow init-end -->`. The model is three-state and intentionally simple:

- **No markers** — `init` appends the marker pair and managed content to `README.md` (or creates a minimal `README.md` if one does not exist).
- **Markers present** — `init` leaves the file alone. Once injected, the user owns the section.
- **`--force`** — `init` overwrites the content between the markers with the current managed content.

Content outside the markers SHALL NOT be modified.

#### Scenario: README absent — created with managed block

- **WHEN** `init --yes` runs and `README.md` does not exist
- **THEN** a `README.md` is created containing a `# <repo-name>` heading followed by the marker pair and managed content

#### Scenario: README present without markers — block appended

- **WHEN** `init --yes` runs and `README.md` exists without the marker pair
- **THEN** the marker pair and managed content are appended to `README.md` separated from existing content by a blank line
- **AND** content above the appended block is byte-identical to the file's previous content

#### Scenario: Markers present — leave alone by default

- **WHEN** `init --yes` runs and `README.md` contains the marker pair
- **THEN** `README.md` is not modified
- **AND** exit code is 0

#### Scenario: Force overwrites the managed block

- **WHEN** `init --yes --force` runs and `README.md` contains the marker pair
- **THEN** content between the markers is replaced with the current managed content
- **AND** content outside the markers is byte-identical to the file's previous content

### Requirement: Secret-state reporting

`install` SHALL report the presence of the `ANTHROPIC_API_KEY` GitHub Actions secret when `gh` is on `PATH` and the working directory resolves to a GitHub remote. `install` SHALL NEVER write a secret value, prompt for one, or transmit one. The probe SHALL always run when the prerequisites are met — there is no opt-out flag.

When the secret is **missing or unknown** (probe skipped), `install` SHALL print a copy-pasteable `gh secret set ANTHROPIC_API_KEY` command annotated with a dim `# Setup Anthropic key` comment. When the secret is detected as **present**, `install` SHALL omit the command block.

#### Scenario: Reports presence when gh is available

- **WHEN** `install --yes` runs and `gh` is on PATH and a GitHub remote is configured and `ANTHROPIC_API_KEY` is set
- **THEN** stdout contains a line indicating `ANTHROPIC_API_KEY` is present
- **AND** no `gh secret set` command is printed

#### Scenario: Prints set command when secret is missing

- **WHEN** `install --yes` runs and the probe reports `ANTHROPIC_API_KEY` as missing
- **THEN** stdout contains the verbatim line `gh secret set ANTHROPIC_API_KEY` annotated with `# Setup Anthropic key`
- **AND** no secret value is written or read

#### Scenario: Prints set command when probe is skipped

- **WHEN** `install --yes` runs and the secret probe is skipped (no `gh`, no remote, or unauthenticated)
- **THEN** stdout contains the verbatim line `gh secret set ANTHROPIC_API_KEY` annotated with `# Setup Anthropic key`

### Requirement: Idempotent and ordered file writes

`init` SHALL determine the planned set of write actions before performing any write. If all planned actions are no-ops, `init` SHALL exit 0 having modified no files on disk.

#### Scenario: Full no-op re-run

- **WHEN** `init --yes` runs in a fully-initialised repo
- **THEN** filesystem `mtime` of every artefact is unchanged
- **AND** exit code is 0

### Requirement: TTY and non-interactive handling

`init` SHALL prompt the user for confirmation before any destructive action (overwriting under `--force`, appending to a non-empty README) only when `process.stdout.isTTY` is true and `--yes` is not passed. When `process.stdout.isTTY` is false and `--yes` is not passed, `init` SHALL exit non-zero with a message instructing the user to pass `--yes`.

#### Scenario: Non-TTY without --yes fails fast

- **WHEN** `init` runs with stdin/stdout not attached to a TTY and `--yes` is absent
- **THEN** stderr contains `refusing to run non-interactively without --yes`
- **AND** exit code is non-zero

#### Scenario: TTY with --yes does not prompt

- **WHEN** `init --yes` runs in a TTY
- **THEN** no interactive prompts are shown

### Requirement: OpenSpec scaffold hard gate

`init` SHALL require an `openspec/` directory at the target root. When `openspec/` is absent, `init` SHALL print instructions referencing `npx @fission-ai/openspec init` and exit non-zero without writing any file. `init` SHALL NOT install or invoke OpenSpec — that scaffold is the user's responsibility and OpenSpec's CLI owns AI-tool selection + skill installation.

#### Scenario: Missing openspec/ exits without writing

- **WHEN** `init --yes` runs in a repo with no `openspec/` directory
- **THEN** stdout contains a line referencing `npx @fission-ai/openspec init`
- **AND** no workflow, README, or other artefact is written
- **AND** exit code is 1

#### Scenario: Present openspec/ proceeds normally

- **WHEN** `init --yes` runs in a repo with an existing `openspec/` directory
- **THEN** the workflow and README block are written

### Requirement: User-facing next-steps instructions

`init` SHALL print, on success, a set of stdout instructions covering at minimum: (1) review the diff, (2) commit on a feature branch, (3) push and open a PR titled `chore: openspec-flow setup`, (4) verify required secrets are set before merging.

#### Scenario: Success prints next-steps block

- **WHEN** `init --yes` completes successfully
- **THEN** stdout contains lines covering review, commit, push, and PR-open
- **AND** the PR title `chore: openspec-flow setup` appears verbatim in the instructions

### Requirement: Exit codes

`init` SHALL use the following exit codes:

- `0` — success (including no-op re-runs)
- `1` — missing `openspec/` scaffold (or other unexpected error)
- `2` — non-TTY invocation without `--yes`

#### Scenario: Success exits 0

- **WHEN** `init --yes` completes any successful path including no-op
- **THEN** exit code is 0

#### Scenario: Missing openspec exits 1

- **WHEN** `init --yes` runs in a repo without `openspec/`
- **THEN** exit code is 1

#### Scenario: Non-TTY without --yes exits 2

- **WHEN** `init` runs without a TTY and without `--yes`
- **THEN** exit code is 2

### Requirement: Label readiness check is read-only and prints create commands

`init` SHALL check whether the three contract labels (`openspec:go`, `openspec:spec`, `openspec:impl`) exist on the target repo, using a read-only `gh label list` when `gh` is on `PATH` and a GitHub remote resolves. `init` SHALL NOT create, edit, or delete any label. For each missing label, `init` SHALL print the exact `gh label create` command — including the canonical color and description — for the user to run.

The canonical labels are:

- `openspec:go` — color `0969da` — "Trigger: start or re-run openspec-flow"
- `openspec:spec` — color `8250df` — "Spec PR raised by openspec-flow"
- `openspec:impl` — color `1a7f37` — "Implementation PR raised by openspec-flow"

#### Scenario: Reports present labels

- **WHEN** `init --yes` runs with `gh` available, a GitHub remote, and all three contract labels already present
- **THEN** the output marks the labels as present
- **AND** no `gh label create` command is printed

#### Scenario: Prints create commands for missing labels

- **WHEN** `init --yes` runs with `gh` available, a GitHub remote, and `openspec:go` absent
- **THEN** the output includes the verbatim command `gh label create "openspec:go" --color 0969da --description "Trigger: start or re-run openspec-flow"`
- **AND** no label is created by `init`

#### Scenario: Skips the check when gh is unavailable

- **WHEN** `init --yes` runs and `gh` is not on `PATH` (or no GitHub remote resolves)
- **THEN** the label check is skipped with a one-line reason
- **AND** exit code is 0

#### Scenario: init never writes labels

- **WHEN** `init` runs in any mode without the (future) `--github-labels` flag
- **THEN** no `gh label create`/`edit`/`delete` subprocess is spawned by `init`

### Requirement: uninstall removes openspec-flow artefacts

`openspec-flow uninstall` SHALL be the inverse of `install`. It SHALL remove `.github/workflows/openspec-flow.yml` when that file matches the current template, and SHALL strip the managed README block between the marker pair while leaving all surrounding content byte-identical. When the workflow file has diverged from the template, `uninstall` SHALL leave it in place and warn, unless `--force` is passed. `uninstall` SHALL print `gh label delete` commands for the contract labels and SHALL NOT delete labels itself. When no openspec-flow artefacts are present, `uninstall` SHALL report that and exit 0.

#### Scenario: Removes shim and strips README block

- **WHEN** `uninstall --yes` runs in a repo where `install` previously wrote the workflow and README block
- **THEN** `.github/workflows/openspec-flow.yml` is deleted
- **AND** the managed block is removed from `README.md`
- **AND** content outside the markers is byte-identical to before the block was added

#### Scenario: Diverged workflow preserved without force

- **WHEN** `uninstall --yes` runs and the workflow file differs from the current template
- **THEN** the workflow file is not removed
- **AND** stdout warns and suggests `--force`
- **AND** exit code is 0

#### Scenario: Force removes a diverged workflow

- **WHEN** `uninstall --yes --force` runs and the workflow file differs from the current template
- **THEN** the workflow file is deleted

#### Scenario: Prints label delete commands, never deletes

- **WHEN** `uninstall --yes` runs
- **THEN** stdout includes `gh label delete "openspec:go" --yes` (and the same for `openspec:spec`, `openspec:impl`)
- **AND** no label is deleted by `uninstall`

#### Scenario: Nothing to uninstall

- **WHEN** `uninstall --yes` runs in a repo with no openspec-flow artefacts
- **THEN** stdout reports nothing to uninstall
- **AND** exit code is 0

### Requirement: Badge block is its own marker-gated region under the H1

When `install` writes the managed README and the target repo's GitHub remote resolves (cwd's `origin` URL parses as `github.com/<owner>/<name>`), it SHALL inject a GitHub Actions status badge for the openspec-flow workflow inside its own marker pair:

```
<!-- openspec-flow badge-start -->
[![openspec-flow](https://github.com/<owner>/<name>/actions/workflows/openspec-flow.yml/badge.svg)](https://github.com/<owner>/<name>/actions/workflows/openspec-flow.yml)
<!-- openspec-flow badge-end -->
```

The badge block SHALL sit immediately under the README's first `# ` H1 line so it appears with title-area badges, separate from the main managed block. It SHALL follow the same three-state model as the main block:

- **No badge markers** — insert under the H1 (or prepend if no H1 exists).
- **Markers present** — leave the block alone; the user owns it.
- **`--force`** — overwrite the content between the markers.

When the GitHub remote cannot be resolved (no `origin`, non-GitHub URL, or git absent), the badge SHALL be omitted entirely. `uninstall` SHALL strip the badge marker pair in addition to the main managed block.

#### Scenario: Badge sits under the H1 with its own markers

- **WHEN** `install --yes` runs in a repo whose origin resolves and whose README has `# My Project` as the first heading
- **THEN** the line immediately after `# My Project` (separated by a blank line) is `<!-- openspec-flow badge-start -->`
- **AND** the badge image-link follows, then `<!-- openspec-flow badge-end -->`

#### Scenario: Re-run leaves the badge block alone

- **WHEN** `install --yes` runs again in a repo that already has the badge markers
- **THEN** the badge block is not modified

#### Scenario: Force overwrites the badge between markers

- **WHEN** `install --yes --force` runs and the badge markers exist
- **THEN** the content between the badge markers is replaced with the current rendered badge

#### Scenario: No GitHub remote → no badge

- **WHEN** `install --yes` runs with no resolvable GitHub `origin`
- **THEN** the README contains no badge marker pair

#### Scenario: uninstall strips both managed regions

- **WHEN** `uninstall --yes` runs against a README with both marker pairs
- **THEN** both the badge block and the main managed block are removed
- **AND** content outside both regions is preserved

### Requirement: Badge H1 anchor ignores fenced code blocks

`install` SHALL anchor the badge block under the first markdown `# ` heading that sits **outside** any fenced code block (`` ``` `` toggles fence state line by line). `# ` lines inside fenced blocks (e.g. bash comments) SHALL NOT be treated as the title. When no markdown H1 exists outside fences, the badge SHALL be prepended at the top of the README.

#### Scenario: Markdown H1 above a fenced block anchors the badge

- **WHEN** `install --yes` runs on a README where line 1 is `# My Tool` and a fenced bash block later contains `# Setup`
- **THEN** the badge marker pair appears directly after `# My Tool`
- **AND** no badge content is inserted inside the fenced block

#### Scenario: HTML-only title falls back to prepend

- **WHEN** `install --yes` runs on a README with no markdown `# ` lines outside fences (e.g. `<p align="center">…</p>` title)
- **THEN** the badge marker pair appears at the top of the file
- **AND** no `# ` lines inside fenced blocks were used as the anchor

