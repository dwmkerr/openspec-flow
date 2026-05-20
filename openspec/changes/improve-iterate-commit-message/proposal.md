## Why

The `iterate-spec` handler (wired in PR #34) commits with a fixed
message: `chore: iterate spec for #<issue>`. That headline tells you
*which issue* iterated but says nothing about *what changed in this
iteration*. Reviewers scanning the PR commit list (e.g. PR #31,
linked from issue #35) see a wall of identical "iterate spec for
#N" headlines and have to open every diff to learn what each
iteration actually did.

The same will be true of `iterate-impl` once it lands with the same
template.

Adding a short, agent-authored description of the iteration's
substance to the commit headline restores commit-list scannability
without changing the trigger, branch, or PR contract.

## What Changes

- **`iterate-spec` handler emits a descriptive commit headline** of
  the form `chore: iterate spec for #<issue> — <short-description>`.
  The short description summarises what the iteration *did* (e.g.
  `clarify multi-line handling`, `tighten failure contract`,
  `drop redundant requirement`). One line, ≤ 60 chars after the em
  dash, lower-case, no trailing punctuation, conventional-commit
  body style.
- **Agent produces the short description** as part of the same run
  that rewrites the spec. The prompt is extended with one
  instruction: after rewriting, write a one-line description of the
  iteration to a known path in the workdir (e.g.
  `.openspec-flow/iterate-summary.txt`). The bot reads that file
  and embeds it in the commit message. If the file is missing or
  empty, the bot falls back to the current
  `chore: iterate spec for #<issue>` headline (no regression).
- **No PR-title change.** Only the commit headline is affected.
  PR title is set on PR open and isn't rewritten on iterate.
- **No body / footer change.** The commit body stays empty.
- **Same shape for `iterate-impl` when it lands.** Out of scope for
  this change (handler not yet wired), but the
  `iterate-spec-handler` spec change is written so the
  `iterate-impl-handler` spec can mirror it verbatim later.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `iterate-spec-handler`: tighten the commit-headline requirement
  so the headline carries a short, agent-authored description of
  the iteration. Adds a requirement governing how the description
  is produced (agent file-drop + bot read), the format constraints
  on the description, and the fallback when the file is missing.

## Impact

- **Depends on**: `wire-iterate-spec-handler` (PR #34) landing
  first. This change modifies a capability that change introduces.
- **Affected code**:
  - `src/handlers/iterate-spec/index.ts` — read summary file, embed
    in commit headline, fall back on miss.
  - `src/handlers/iterate-spec/prompt.md` — add the
    one-line-summary instruction and the file path contract.
  - `src/handlers/iterate-spec/index.test.ts` — cases for happy
    path (summary present), missing file (fallback), empty file
    (fallback), oversized summary (truncated).
- **Not affected**: `create-spec`, `create-impl`, `iterate-impl`
  (not yet wired), classifier, dispatcher, label contract.
- **No new deps.**
- **No CLI surface change.**

## Out of scope

- `iterate-impl` handler — separate change once that handler is
  wired. The spec wording introduced here can be lifted verbatim.
- Body / footer of the iterate commit. The headline is what shows
  up in the PR commit list; the body adds no scannability win.
- AI-authored PR titles. PR title is set once at create-spec time
  and reflects the originating issue.
- Multiple commits per iterate run. Iterate is still one squashed
  commit; no commit-per-artefact split.
