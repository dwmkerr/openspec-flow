# Design — shim-init

## Context

`@dwmkerr/openspec-flow` already ships a `bin/openspec-flow` binary
(see `wire-agent-runtime`) registered in `package.json` `bin`. Today
it exposes `handle <intent>` subcommands for invoking webhook
handlers from a CLI. RFC `rfc-shim-architecture` (#26, §Decision 5)
landed on a one-shot `init` subcommand as the canonical install
path for Action mode: target-repo owners run
`npx @dwmkerr/openspec-flow init`, three files appear, and they
commit + push.

Issue #45 carves the thinnest viable slice. It writes files,
reports secret state, and gets out of the way. Everything
interactive (skill install, schema validation, auto-PR) is a
follow-up.

### Current state

- Action-mode install today: copy-paste from `docs/architecture.md`.
- Three secrets must be set out-of-band (`ANTHROPIC_API_KEY`,
  `OPENSPEC_FLOW_APP_ID`, `OPENSPEC_FLOW_PRIVATE_KEY`).
- README install section is hand-written per repo. No agreed
  marker contract.

### Constraints

- One npm package, one binary. No second package for the installer.
- Node ≥ 22, CommonJS, TypeScript strict (per `CLAUDE.md`).
- Tests sit next to source (`*.test.ts`) or under
  `tests/integration/` (per `CLAUDE.md`).
- Read-only on the user's GitHub state. No `gh secret set`, no
  `gh api` writes.
- No Claude API call from `init`. Adding a Claude dependency to the
  install flow would gate the install on `ANTHROPIC_API_KEY`,
  which is one of the things `init` is supposed to discover is
  missing.

## Goals / Non-Goals

**Goals:**

- One command, three files, idempotent.
- Visible feedback on which secrets are missing.
- Honest no-op on re-run; honest non-zero on drift unless `--force`.
- TUI that degrades cleanly: TTY → prompts; `--yes` or pipe → no prompts.
- Smoke-testable end-to-end without network (the `gh` reporter is
  skipped when `gh` isn't on `PATH`).

**Non-Goals (deferred to follow-up issues, per #45 body):**

- Auto-open a setup PR via App token.
- IDE detection + `.claude/skills` / `.cursor/rules` install.
- Detect + run `openspec init` for the target repo.
- `zod` schema for `.openspec-flow.yaml` (the stub is comments only).
- Animated welcome screen.
- `act` local-runner recipe.
- Drift detection across installs (RFC defers this).

## Decisions

### D1. `init` is a subcommand of the existing `openspec-flow` binary

**Decision**: Register `init` on the same `commander` program that
`wire-agent-runtime` introduced. Source under `src/cli/init/`.

**Alternatives considered**:

- *Separate binary `openspec-flow-init`*. Rejected: two binaries
  doubles the `bin` entries, complicates `npx` invocation
  (`npx @dwmkerr/openspec-flow-init` works, but the existing
  `npx @dwmkerr/openspec-flow init` reads more naturally).
- *Separate npm package `create-openspec-flow`*. Rejected for the
  thin slice: another release surface to maintain. Revisit when
  the install grows IDE + skill bits.

### D2. CLI stack: `commander` + `@inquirer/prompts` + `chalk` + `ora`

Lifted directly from the RFC's research note. `commander` for arg
parsing (we already need it for the existing CLI), `@inquirer/prompts`
for TTY questions, `chalk` for colour, `ora` for the spinner during
`gh secret list`. `@inquirer/core` is a peer of `prompts`; we
declare it for typing only.

**Alternatives considered**: `yargs` (heavier, less idiomatic for
small CLIs); `prompts` (less actively maintained); raw `readline`
(no TTY/non-TTY auto-handling).

### D3. Three file artefacts, exact paths

| Path | Source | Idempotent? |
|---|---|---|
| `.github/workflows/openspec-flow.yml` | `src/cli/init/templates/openspec-flow.yml` | yes, byte-compare |
| `.openspec-flow.yaml` | `src/cli/init/templates/openspec-flow.yaml` | yes, byte-compare |
| `README.md` (block) | `src/cli/init/templates/readme-block.md` | yes, marker-extracted block compared |

The workflow template is the literal shim from
`docs/architecture.md` §Mode A — Action install. The config stub is
all comments (no live keys) so it has no schema today. The README
block is wrapped in marker comments:

```
<!-- openspec-flow:install-start -->
…install instructions…
<!-- openspec-flow:install-end -->
```

If both markers are present, the block between them is replaced (or
left untouched if already current). If neither is present, the
markers + block are appended. If exactly one is present, that's a
drift error: bail with non-zero exit unless `--force`.

### D4. Idempotency model

Each writer is a pure function `write(opts) → 'created' | 'unchanged' | 'drifted'`.

- `created`: file did not exist (or markers absent in README); wrote it.
- `unchanged`: file exists, content matches template byte-for-byte.
- `drifted`: file exists, content differs.

`init` aggregates the three results.

| Aggregate | Without `--force` | With `--force` |
|---|---|---|
| all `created` / `unchanged` | exit 0 | exit 0 |
| any `drifted` | print diff summary, exit 1 | overwrite, exit 0 |

This keeps the "re-run is safe" contract honest: the only way to
clobber a user's edits is the explicit `--force`.

### D5. Secret-presence report

Run `gh secret list --json name -q '.[].name'` once and intersect
with the required-secret set. Skipped (with a printed note) when:

- `gh` is not on `PATH`, or
- `gh auth status` fails (no token), or
- the user passes `--no-secret-check`.

Output format:

```
Secrets in this repo:
  ✓ ANTHROPIC_API_KEY
  ✗ OPENSPEC_FLOW_APP_ID       — set with: gh secret set OPENSPEC_FLOW_APP_ID
  ✗ OPENSPEC_FLOW_PRIVATE_KEY  — set with: gh secret set OPENSPEC_FLOW_PRIVATE_KEY < key.pem
```

A missing secret is **a report, not a failure**. Exit code is
unaffected. Rationale: the user installs and commits today; sets
secrets when they're ready. Forcing the order ("set secrets, then
install") doubles the install ceremony for no gain.

### D6. TTY gating + `--yes`

Prompts ask three questions in the thin slice:

1. "Write workflow to `.github/workflows/openspec-flow.yml`?" — default Yes.
2. "Write config stub to `.openspec-flow.yaml`?" — default Yes.
3. "Patch README install block?" — default Yes.

`--yes` (or `process.stdin.isTTY === false`) skips all prompts and
defaults each answer to Yes. `--dry-run` answers Yes everywhere but
writes nothing; prints the diff of what would have been written.

### D7. Final stdout — instructions, not actions

Last block printed:

```
Next steps:
  1. git add .github/workflows/openspec-flow.yml .openspec-flow.yaml README.md
  2. git commit -m "chore: install openspec-flow"
  3. git push
  4. (optional) Set the missing secrets above.
```

No `git` invocation by the CLI. No PR opened. The user owns the
final mile, per RFC §Decision 5.

### D8. Where templates live

Templates ship as files under `src/cli/init/templates/`. They are
`fs.readFileSync`'d at module load and stored as module-level
constants. Reasons:

- Diff-friendly in PRs (renders as YAML / Markdown).
- Editable without TypeScript escaping.
- Same convention as `wire-agent-runtime`'s prompts-as-markdown.

`package.json` `files` already includes `dist`; the build copies
templates verbatim into `dist/cli/init/templates/`. Add a one-line
`tsc` post-step (`scripts/copy-templates.ts` invoked from
`build`) — straightforward and tested by the integration test.

## Risks / Trade-offs

- **[Template drift between docs and CLI]** → Single source of truth:
  the template files. `docs/architecture.md` quotes the file (or
  references it) rather than maintaining its own copy.
- **[`gh` is not installed for some users]** → Skipped silently with
  a one-line note; install still succeeds.
- **[`--force` clobbers a user's curated workflow]** → Drift report
  is printed first; `--force` is opt-in and named loudly. We do
  not write a backup file (out of scope for the thin slice).
- **[Marker collisions in pre-existing READMEs]** → Markers are
  `openspec-flow`-scoped; collision risk is negligible. If a user
  has their own block with these markers, drift reporting catches it.
- **[`@inquirer/prompts` ESM-only]** → Confirmed compatible with
  CommonJS callers via dynamic `import()`; the CLI entry uses
  `await import('@inquirer/prompts')` inside `init`. Documented in
  `src/cli/init/index.ts`.

## Migration Plan

- **Deploy**: cut a patch release of `@dwmkerr/openspec-flow` once
  the impl PR lands. No infra change.
- **Rollback**: `npm deprecate` the broken version; users on the
  old version are unaffected because the binary they invoked is the
  one they installed.
- **Docs**: `docs/architecture.md` §Mode A is rewritten to lead
  with `npx @dwmkerr/openspec-flow init` and to point at the
  workflow file as the artefact, not its content.

## Open Questions

- Should `init` write to a non-default branch? (Default: current
  branch.) Followup if multiple users ask. Out of scope for #45.
- Should `init` detect a monorepo and offer to write the workflow
  at the workspace root vs. a package subdir? Out of scope; the
  RFC defers this.
