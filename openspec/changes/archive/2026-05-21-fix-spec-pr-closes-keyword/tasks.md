## 1. Spec PR body wording

- [x] 1.1 Edit `src/handlers/create-spec/pr.ts` `buildSpecPrBody` to emit `Refs #${opts.issueNumber}.` instead of `Closes #${opts.issueNumber}.` Leave the HTML metadata block untouched.
- [x] 1.2 Update `src/handlers/create-spec/index.test.ts` (the assertion at line ~104 that expects `Closes #10`) to expect `Refs #10` and add a negative assertion that the body does NOT contain `Closes #10`, `Fixes #10`, or `Resolves #10`.
- [x] 1.3 Audit any other create-spec test or fixture asserting on `Closes` in the spec PR body and switch to `Refs`. Do NOT touch impl-handler tests/fixtures — impl PR still uses `Closes`.

## 2. Intent classifier

- [x] 2.1 Locate the issue-number extraction regex in `src/intent.ts` (the one currently matching `closes|fixes|resolves`).
- [x] 2.2 Broaden it to also match `refs`, `references`, and `relates to` (case-insensitive). Keep the existing tokens so in-flight spec PRs that already used `Closes` continue to classify.
- [x] 2.3 Extend `src/intent.test.ts`: add a case where a merged `openspec:spec` PR body contains `Refs #42` and assert the classifier returns `create-impl` with `issueNumber: 42`. Keep the existing `Closes #42` legacy case green.

## 3. CLAUDE.md sync

- [x] 3.1 In `CLAUDE.md` → "Linkage — issue ↔ spec PR ↔ impl PR" update the example spec PR body snippet's preceding prose so it explicitly states the spec PR uses `Refs #N` (non-closing) while the impl PR uses `Closes #N` (auto-close on merge).
- [x] 3.2 Confirm `README.md`, `public/index.html`, `docs/architecture.md`, `docs/developer-guide.md`, `docs/app-setup.md` do not contradict the new wording. Fix any that mention spec PRs auto-closing the issue.

## 4. Validate and archive

- [x] 4.1 Run `openspec validate fix-spec-pr-closes-keyword --strict` and fix any reported issues.
- [x] 4.2 Run the full test suite (`make test` or `npm test`) and confirm green.
- [ ] 4.3 Archive the change in the impl PR with `openspec archive fix-spec-pr-closes-keyword --yes` so the delta merges into `openspec/specs/create-spec-handler/spec.md` and `openspec/specs/intent-recognition/spec.md`.
