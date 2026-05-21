## 1. Package + binary plumbing

- [ ] 1.1 Add `bin` entry `openspec-flow` in `package.json` pointing at `dist/cli/openspec-flow.js`
- [ ] 1.2 Add runtime deps: `commander@^14`, `@inquirer/prompts@^7`, `@inquirer/core@^10`, `chalk@^5`, `ora@^8`
- [ ] 1.3 Create `bin/openspec-flow.js` shebang shim that re-exports `dist/cli/openspec-flow.js`
- [ ] 1.4 Wire TypeScript build to emit `dist/cli/openspec-flow.js`
- [ ] 1.5 Add `prepack` check to confirm `bin/openspec-flow.js` exists and is executable

## 2. CLI scaffold

- [ ] 2.1 Create `src/cli/openspec-flow.ts` — commander root, version from `package.json`, `--no-color` global
- [ ] 2.2 Create `src/cli/commands/init.ts` — `init` subcommand definition with all flags from the spec
- [ ] 2.3 Create `src/cli/ui/palette.ts` — 4-tone grayscale via `chalk.hex()` matching the OpenSpec CLI palette
- [ ] 2.4 Create `src/cli/ui/title.ts` — single-line bordered title (no animation in this slice)
- [ ] 2.5 Create `src/cli/ui/interactive.ts` — `isInteractive()` helper matching `@fission-ai/openspec`'s gate

## 3. Artefact writers

- [ ] 3.1 Create `src/cli/templates/workflow.yml.ts` — shim template + `renderWorkflow(version)`
- [ ] 3.2 Create `src/cli/templates/config.yml.ts` — commented config stub
- [ ] 3.3 Create `src/cli/templates/readme-block.ts` — managed README content + marker constants
- [ ] 3.4 Create `src/cli/templates/known-hashes.ts` — set of known shim template hashes, starting with current
- [ ] 3.5 Create `src/cli/io/plan.ts` — pure function: current FS state + flags → list of planned actions
- [ ] 3.6 Create `src/cli/io/apply.ts` — execute a plan; touch nothing if every action is a no-op

## 4. Detection + reporting

- [ ] 4.1 Create `src/cli/detect/openspec-dir.ts` — detect `openspec/` presence
- [ ] 4.2 Create `src/cli/detect/gh.ts` — detect `gh` on PATH; resolve GitHub remote `owner/repo`
- [ ] 4.3 Create `src/cli/detect/secrets.ts` — `gh secret list` JSON parse; classify the three known names
- [ ] 4.4 Create `src/cli/ui/report.ts` — render secret status table + skip-reasons

## 5. Interactive prompts

- [ ] 5.1 Add confirm prompt before any destructive action (only under TTY + no `--yes`)
- [ ] 5.2 Add advisory print for missing `openspec/` (no prompt — single line + continue)

## 6. Next-steps output

- [ ] 6.1 Create `src/cli/ui/next-steps.ts` — copy-pasteable instructions; verbatim PR title `chore: openspec-flow setup`
- [ ] 6.2 Print only on a non-no-op run; suppress on full no-op

## 7. Tests

- [ ] 7.1 Unit tests for `plan.ts` across all states (fresh, current, hand-edited, missing markers, force/no-force)
- [ ] 7.2 Unit tests for README marker patch logic — content outside markers byte-identical pre/post
- [ ] 7.3 Unit tests for shim hash matching across versioned templates
- [ ] 7.4 Integration test `tests/integration/shim-init.test.ts` — spawn the binary against a tmp dir, assert all spec scenarios
- [ ] 7.5 Snapshot test for next-steps stdout

## 8. Docs sync

- [ ] 8.1 Add `## Install (CLI)` section to root `README.md` pointing at `npx @dwmkerr/openspec-flow init`
- [ ] 8.2 Add a short note to `docs/architecture.md` that `init` is the canonical local writer of the shim
- [ ] 8.3 Cross-check root `CLAUDE.md` — confirm nothing in the label, identity, or install-modes contract changed

## 9. Verification + archive

- [ ] 9.1 Run `openspec validate shim-init` until clean
- [ ] 9.2 Run repo lint + tests
- [ ] 9.3 Archive the change as part of the impl PR (`openspec archive shim-init --yes`)
