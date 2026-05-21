# Tasks — shim-init

## 1. Deps + scaffolding

- [ ] 1.1 `npm i commander @inquirer/prompts @inquirer/core ora js-yaml`
      (`chalk` already present from `wire-agent-runtime`)
- [ ] 1.2 `npm i -D @types/js-yaml`
- [ ] 1.3 Create directory `src/cli/init/` with `index.ts` placeholder
- [ ] 1.4 Create directory `src/cli/init/templates/` with empty
      `openspec-flow.yml`, `openspec-flow.yaml`, `readme-block.md`
- [ ] 1.5 Add `scripts/copy-templates.ts` that copies
      `src/cli/init/templates/*` → `dist/cli/init/templates/*`; wire
      into `build` script in `package.json` after `tsc`

## 2. Templates

- [ ] 2.1 Author `src/cli/init/templates/openspec-flow.yml` — the
      reusable-workflow shim copied verbatim from
      `docs/architecture.md` §Mode A, pinned at `@v1`, passing the
      three required secrets
- [ ] 2.2 Author `src/cli/init/templates/openspec-flow.yaml` — all
      comments, no live keys, includes a header pointer to the
      repository for future schema docs
- [ ] 2.3 Author `src/cli/init/templates/readme-block.md` — install
      instructions including the `npx @dwmkerr/openspec-flow init`
      one-liner and a bullet list of the three required secrets

## 3. Writers (idempotent, pure)

- [ ] 3.1 `src/cli/init/write-workflow.ts` exporting
      `writeWorkflow({ cwd, force }) → 'created' | 'unchanged' | 'drifted'`.
      Byte-compares against the template; writes when missing; reports
      drift; overwrites when `force`
- [ ] 3.2 `src/cli/init/write-config.ts` exporting `writeConfig(...)`
      with the same return shape; same idempotency rules
- [ ] 3.3 `src/cli/init/patch-readme.ts` exporting `patchReadme(...)`
      that handles three cases: no markers (append), both markers
      (replace between if drifted, else `unchanged`), one marker
      (return `drifted`). Use a real parser/regex with anchored
      capture for the marker block; do not greedy-match across
      multiple blocks
- [ ] 3.4 Unit tests next to each writer covering create / unchanged /
      drifted / force-overwrite branches

## 4. Secret-presence reporter

- [ ] 4.1 `src/cli/init/report-secrets.ts` exporting
      `reportSecrets({ ora }) → Promise<void>`. Checks `gh` on
      `PATH`, runs `gh auth status` then
      `gh secret list --json name -q '.[].name'`, intersects with the
      required-secret set, prints one line per secret with `✓` / `✗`.
      Skips gracefully with a single note when `gh` is missing or
      unauthenticated
- [ ] 4.2 Unit test mocks the child-process invocation and asserts
      the printed line for each of the three secrets in three cases:
      all present, all absent, mixed

## 5. CLI entry

- [ ] 5.1 `src/cli/init/index.ts` exporting `runInit(opts)`:
      parse flags (`--yes`, `--force`, `--no-secret-check`,
      `--dry-run`), TTY-gate prompts via `@inquirer/prompts`,
      call the three writers, call the reporter, print the final
      next-steps block. Honour `--dry-run` by computing results and
      printing the would-be diffs without writing
- [ ] 5.2 Register the subcommand on the existing `commander`
      program in `src/cli.ts`. Command description: "Install
      openspec-flow in the current repository (writes workflow shim,
      config stub, and README install block)."
- [ ] 5.3 Aggregate writer results: exit 0 when all are
      `created`/`unchanged`; exit 1 when any is `drifted` and
      `--force` was not passed

## 6. Smoke test

- [ ] 6.1 `tests/integration/shim-init.test.ts`:
      - Create a tmp dir; `git init` it; touch `README.md`
      - Invoke `runInit({ cwd, yes: true, secretCheck: false })`
      - Assert `.github/workflows/openspec-flow.yml` exists and
        contains `dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v1`
      - Assert `.openspec-flow.yaml` exists and parses as empty YAML
      - Assert `README.md` ends with both marker lines and the
        block between them
      - Re-invoke; assert no file mtime changed (second run is no-op)

## 7. Docs

- [ ] 7.1 Update `docs/architecture.md` §Mode A to lead with
      `npx @dwmkerr/openspec-flow init` and reference the template
      file rather than embedding workflow YAML inline
- [ ] 7.2 Update `README.md` between the markers (run `init` once
      against the repo itself so the README's own install block is
      authoritative)

## 8. Verify + ship

- [ ] 8.1 `npm run typecheck` passes
- [ ] 8.2 `npm run test` (unit) passes
- [ ] 8.3 `npm run test:integration` passes including the new smoke
      test
- [ ] 8.4 Manual smoke: in a scratch repo,
      `npx --prefix . openspec-flow init --yes` produces the three
      artefacts and prints the secret report
- [ ] 8.5 `openspec validate shim-init` passes
- [ ] 8.6 Commit; impl PR archives this change per the OpenSpec
      lifecycle in `CLAUDE.md`
