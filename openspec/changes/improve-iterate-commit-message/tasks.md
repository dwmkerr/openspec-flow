# Tasks — improve-iterate-commit-message

> Depends on `wire-iterate-spec-handler` (PR #34) landing first.
> Touches files introduced by that change.

## 1. Headline utility

- [ ] 1.1 Create `src/handlers/iterate-spec/headline.ts` exporting
      two pure functions: `readIterateSummary(workdir: string): string`
      (returns trimmed first-non-empty-line of
      `.openspec-flow/iterate-summary.txt`, or empty string if
      missing/empty/whitespace-only) and `buildIterateHeadline(issueNumber: number, summary: string): string`
      (returns `chore: iterate spec for #<n>` when summary is empty,
      otherwise `chore: iterate spec for #<n> — <summary>` with the
      summary collapsed to one line, stripped of control chars,
      lower-cased, trailing punctuation removed, and truncated to 60
      chars with `…` appended if oversized).
- [ ] 1.2 Add `src/handlers/iterate-spec/headline.test.ts` covering:
      missing file → fallback; empty file → fallback; whitespace-only
      file → fallback; single-line summary → em-dash headline; oversized
      summary → truncated with `…`; multi-line summary → first
      non-empty line only; embedded tabs/newlines stripped; trailing
      period removed; em-dash codepoint is U+2014.

## 2. Workdir gitignore

- [ ] 2.1 In `src/handlers/iterate-spec/index.ts`, after
      `fetchAndCheckoutBranch` and before `runAgent`, append
      `.openspec-flow/` to the workdir's `.gitignore` (creating the
      file if it doesn't exist; idempotent — don't append if the
      entry is already present).
- [ ] 2.2 Add a test asserting `git add -A` followed by
      `git status --porcelain` does not surface
      `.openspec-flow/iterate-summary.txt` after the agent writes
      it.

## 3. Handler wires the descriptive headline

- [ ] 3.1 Modify `src/handlers/iterate-spec/index.ts` to call
      `readIterateSummary(workdir)` after the agent run returns
      (before `verifyIterateWorkdir`), pass the result to
      `buildIterateHeadline(issueNumber, summary)`, and use the
      returned string as the `commit(workdir, headline)` argument.
- [ ] 3.2 Log the chosen headline at `info` level (single line,
      includes the change name and PR number for grep-ability).
- [ ] 3.3 Update `src/handlers/iterate-spec/index.test.ts`:
      happy-path test asserts the descriptive headline is passed
      to `commit`; new test stubs `readIterateSummary` to return
      empty string and asserts the fallback headline is used.

## 4. Prompt update

- [ ] 4.1 Append a final step to `src/handlers/iterate-spec/prompt.md`
      instructing the agent to write a one-line summary of what the
      iteration changed to `.openspec-flow/iterate-summary.txt`.
      Spell out: ≤ 60 chars, lower-case, no trailing punctuation,
      describes substance (not the fact of iteration). Give one
      good example and one bad example.
- [ ] 4.2 Verify the prompt-rendering integration test still passes;
      add a snippet assertion that the file path and length limit
      are present in the rendered prompt.

## 5. Spec sync

- [ ] 5.1 `openspec validate improve-iterate-commit-message` is clean.
- [ ] 5.2 Archive the change in the impl PR via
      `openspec archive improve-iterate-commit-message --yes`. The
      MODIFIED requirement and the new ADDED requirement merge into
      `openspec/specs/iterate-spec-handler/spec.md`.

## 6. Docs

- [ ] 6.1 Add a one-paragraph note to `docs/architecture.md` under
      the iterate-spec section explaining the summary-file contract
      and the fallback behaviour.
- [ ] 6.2 No changes required to `CLAUDE.md` (the public label /
      trigger contract is unchanged); confirm by re-reading the
      "What must stay in sync" list.

## 7. Manual verification

- [ ] 7.1 In a dev install, trigger iterate on an open spec PR and
      confirm the resulting commit headline includes the em-dash
      description.
- [ ] 7.2 Trigger iterate with a broken agent run that doesn't write
      the summary file (e.g. via test fixture) and confirm the
      fallback headline is used and no failure comment is posted.
