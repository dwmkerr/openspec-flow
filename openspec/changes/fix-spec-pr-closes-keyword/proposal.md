## Why

Spec PRs currently include `Closes #N` in their body. GitHub treats that
as an auto-close directive — merging the spec PR closes the originating
issue before the impl PR has even opened. The intended contract
(CLAUDE.md, "Linkage" section) is that **only the impl PR closes the
issue**; the spec PR merely *refers* to the issue. Issue #28 reports
exactly this: PR #27 (a spec PR) used `Closes #26` and short-circuited
the lifecycle. We need to use a neutral reference keyword on spec PRs.

## What Changes

- `buildSpecPrBody` (`src/handlers/create-spec/pr.ts`) emits
  `Refs #N.` instead of `Closes #N.` so merging a spec PR does **not**
  auto-close the issue.
- The impl PR body (`src/handlers/create-impl/index.ts`) is unchanged —
  it still emits `Closes #N.` so merging the impl PR auto-closes the
  issue, preserving the existing end-of-lifecycle behaviour.
- `intent-recognition` keeps extracting the issue number from a
  `closes|fixes|resolves|refs|references|relates to #N` reference in
  the spec PR body so the existing `create-impl` mapping still works
  off the spec PR. (The `refs` family must be added to the regex.)
- `CLAUDE.md` "Linkage" section: clarify that the spec PR uses `Refs`
  and only the impl PR uses `Closes`; update the example spec PR body
  snippet accordingly.

## Capabilities

### New Capabilities
- _(none)_

### Modified Capabilities
- `create-spec-handler`: requirement on the spec PR body wording — must
  use `Refs #N` (not `Closes #N`) so the originating issue stays open
  when the spec PR merges.
- `intent-recognition`: requirement on extracting the issue number from
  a merged spec PR — must accept `refs|references|relates to` in
  addition to `closes|fixes|resolves`.

## Impact

- Code: `src/handlers/create-spec/pr.ts` (one-line wording change),
  tests under `src/handlers/create-spec/` and
  `src/handlers/shared/spec-pr-metadata.test.ts` if they assert on the
  exact `Closes` token, and `src/intent.ts` (broaden the issue-number
  extraction regex). Impl-handler code path unchanged.
- Behaviour: spec PR merge no longer closes the issue; only impl PR
  merge does. Lifecycle now matches CLAUDE.md.
- Docs: `CLAUDE.md` linkage example. No public API change. No data
  migration. Existing in-flight spec PRs already merged with
  `Closes #N` are unaffected (they have already closed their issues);
  this change only affects spec PRs opened from this commit onward.
