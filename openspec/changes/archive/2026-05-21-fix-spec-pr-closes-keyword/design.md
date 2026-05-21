## Context

The `openspec-flow` lifecycle (see `CLAUDE.md` → "The flow" and
"Linkage") is five beats and two PRs: a spec PR (intermediate, must
stay open until reviewed) and an impl PR (final, closes the originating
issue on merge). GitHub's auto-close keywords (`closes`, `fixes`,
`resolves`) in a PR body cause the issue to close as soon as that PR
merges. The spec PR body therefore must **not** contain any of those
keywords for the originating issue.

The current implementation in `src/handlers/create-spec/pr.ts` line 14
emits:

```ts
return `${head}\n\nCloses #${opts.issueNumber}.\n\n<!-- ... -->\n`;
```

Issue #28 was raised after PR #27 (spec PR for issue #26) merged and
auto-closed #26 before any impl PR existed. This is a wording bug, not
an architectural one.

A separate, dependent concern: the intent classifier
(`src/intent.ts`, spec at
`openspec/specs/intent-recognition/spec.md` lines 38–51) extracts the
issue number from a merged spec PR by scanning the body for
`closes|fixes|resolves #N`. Once spec PRs stop using `Closes`, the
classifier must accept the new reference keyword (`refs`, and ideally
the wider `references|relates to` family) or `create-impl` events will
arrive with `issueNumber: null`.

## Goals / Non-Goals

**Goals:**
- Spec PRs do not auto-close their originating issue on merge.
- Impl PR behaviour is unchanged (still `Closes #N`, still auto-closes).
- The intent classifier can still recover the issue number from a
  merged spec PR body.
- The HTML metadata block (the canonical linkage) is unchanged.
- `CLAUDE.md` "Linkage" section reflects the new wording.

**Non-Goals:**
- No change to label semantics (`openspec:go`, `openspec:spec`,
  `openspec:impl`).
- No change to branch naming, commit format, or chained mode.
- No retroactive fix for already-merged spec PRs.
- No change to impl PR body wording.

## Decisions

**Decision 1 — Use `Refs #N.` on the spec PR body.**

Considered alternatives:

| Option | Auto-close? | Why rejected |
|---|---|---|
| `Closes #N.` (status quo) | yes | Bug — issue closes too early. |
| `Refs #N.` | no | Chosen. Short, idiomatic, unambiguous. |
| `Related to #N.` | no | Wordier; not a recognised GitHub keyword (intent classifier would need a multi-token regex). |
| `References #N.` | no | Equivalent to `Refs`; longer. |
| Omit reference entirely | n/a | Loses human-readable backlink; the HTML metadata is hidden. |

GitHub treats none of `refs|references|relates to` as auto-close
keywords (only `close[sd]`, `fix(es|ed)`, `resolve[sd]` are). `Refs`
is the conventional short form already widely used in Git workflows.

**Decision 2 — Broaden intent-recognition regex, do not replace it.**

The classifier currently matches `/(?:closes|fixes|resolves)\s+#(\d+)/i`
(per `intent-recognition/spec.md`). We extend it to also match
`refs|references|relates\s+to`. We keep `closes|fixes|resolves` so
already-merged spec PRs in flight (and any human-authored PR using
the auto-close family) still classify correctly.

**Decision 3 — Keep the HTML metadata block as the canonical
linkage.**

The auto-maintained metadata block (`issue: N`, `kind: spec`,
`change: <name>`) is parsed by `parseSpecPrMetadata` and is the
contract per `CLAUDE.md`. The visible `Refs #N` line is a fallback
for the classifier and a human-readable backlink. Nothing in the
metadata block changes.

**Decision 4 — Update `CLAUDE.md` in the same change.**

`CLAUDE.md` is the source of truth and explicitly says it must be
updated when linkage format changes. The "Linkage" section currently
reads:

> The PR body also contains a visible `Closes #42` line so GitHub
> auto-closes the issue when the impl PR merges.

The wording is correct *for the impl PR* but the symmetric statement
for the spec PR is missing. We add an explicit statement that the
spec PR uses `Refs #N`.

## Risks / Trade-offs

- **[Risk] Existing tests assert on the literal `Closes` token in
  the spec PR body.** → Mitigation: update
  `src/handlers/create-spec/index.test.ts` (line 104) and any
  spec-PR-body fixtures to assert on `Refs` instead. Impl-PR tests
  stay on `Closes`.
- **[Risk] An older spec PR that was opened before this change
  merges *after* this change deploys.** → Mitigation: classifier
  still accepts `closes|fixes|resolves`, so the existing
  `create-impl` path keeps working for in-flight PRs.
- **[Risk] Humans writing spec PRs by hand re-introduce `Closes`.**
  → Mitigation: the handler is the only writer of spec PR bodies in
  the supported flow; the bot owns the body content. No automated
  enforcement needed.
- **[Trade-off] `Refs` is informal compared to `References`.** →
  Accepted; `Refs` is shorter, widely understood in Git, and matches
  conventional-commit-style trailers.

## Migration Plan

1. Land code + tests + docs in one PR (this change).
2. No data migration; behaviour change is forward-only.
3. Rollback: revert the PR. Spec PRs return to using `Closes`. No
   persistent state to undo.
