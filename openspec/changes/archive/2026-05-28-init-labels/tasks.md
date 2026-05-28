## 1. Capability rename

- [x] 1.1 `git mv openspec/specs/shim-init openspec/specs/init`
- [x] 1.2 Fix the spec title + Purpose in `openspec/specs/init/spec.md`

## 2. Label probe

- [x] 2.1 Add `probeLabels(cwd)` to `src/init/detect.ts` — read-only `gh label list --json name`; classify the three contract labels as present/missing; degrade to "skipped" when gh absent / no remote
- [x] 2.2 Define the canonical label table (name, color, description) in one place

## 3. Report + next-steps

- [x] 3.1 Render label status (present / missing) in the `init` report
- [x] 3.2 For missing labels, print the verbatim `gh label create` command in next-steps
- [x] 3.3 Note the future `--github-labels` flag in next-steps

## 4. Verification

- [x] 4.1 `npm run build` + `npm run typecheck` clean
- [x] 4.2 Smoke: run `init` in a repo missing a label → create command printed; no label created
- [x] 4.3 `openspec validate init-labels` clean

## 5. Archive

- [x] 5.1 `openspec archive init-labels --yes`
