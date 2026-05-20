## Context

`iterate-spec` (PR #34) commits with a hard-coded headline:

```
chore: iterate spec for #<issue>
```

That headline is identical for every iteration on every spec PR.
Issue #35 shows the symptom: PR #31 has back-to-back commits both
starting `chore: iterate spec for #30`, and the reviewer can't tell
from the commit list what changed in each.

The iterate handler is one squashed commit per agent run. The
content of that commit is whatever the agent rewrote in the
workdir. So the agent is the only thing that knows what the
iteration actually did. The bot owns commit creation (it's the
deterministic mechanic), so the bot must read the description
from somewhere the agent wrote it.

## Goals / Non-Goals

**Goals:**

- Each iterate-spec commit headline carries a short, human-readable
  description of what that iteration changed.
- Description is authored by the agent (it ran the rewrite).
- Bot retains exclusive control over commit creation.
- Zero regression when the description is missing — fall back to
  today's headline.
- Format is reusable verbatim by `iterate-impl` later.

**Non-Goals:**

- Multi-line commit bodies.
- AI-rewritten PR titles.
- Per-file or per-artefact commits.
- Re-running the agent if the summary file is missing.
- Surfacing the summary anywhere outside the commit (no PR
  comment, no review thread).

## Decisions

### 1. Agent writes summary to a known file in the workdir

The agent's prompt is extended with a final instruction: after the
spec rewrite, write a one-line summary to
`.openspec-flow/iterate-summary.txt` in the workdir. The bot
reads that file after the agent run returns.

**Alternative considered**: parse the summary out of the agent's
stdout. Rejected — agent stdout is unstructured prose, fragile to
parse, and we'd be one prompt tweak away from a regex breaking.

**Alternative considered**: ask the agent to print the summary as
the *last line* of stdout. Rejected — same fragility, and the
SDK's tool-call interleaving means "last line" isn't deterministic.

**Alternative considered**: have the bot diff the workdir after
the agent run and feed the diff to a second Claude call asking
"summarise this in one line". Rejected — doubles the per-iterate
cost and adds a second failure mode for no benefit; the rewriting
agent already knows what it did.

**File path**: `.openspec-flow/` is gitignored by the harness'
clone (the bot deletes it before staging) so the summary file
never ends up in the commit itself.

### 2. Headline format: em-dash separator

```
chore: iterate spec for #<issue> — <short-description>
```

- Conventional-commit type stays `chore:` (matches today).
- Issue reference stays in the headline so the commit list groups
  visually by iteration target.
- Em dash (`—`, U+2014) separates the static prefix from the
  agent-authored suffix. Easy to read, easy to grep, doesn't
  collide with `:` (already used by `chore:`) or `-` (used in
  many short descriptions).

**Alternative considered**: drop `for #<issue>` and use
`chore(iterate-spec): <description>`. Rejected — losing the issue
number breaks the existing visual grouping; conventional-commit
scopes don't help when every iterate commit would share the same
scope.

### 3. Description constraints

- ≤ 60 chars after the em dash (keeps total headline under
  ~100 chars; GitHub truncates around 72 in the PR commit list).
- Lower-case, no trailing punctuation.
- Imperative or descriptive mood is fine (`clarify multi-line
  handling`, `tighter failure contract`).
- Bot truncates with `…` if the agent overshoots. No agent retry —
  truncation is a soft failure, not a hard one.

### 4. Fallback contract

If `.openspec-flow/iterate-summary.txt` is missing, empty, or
whitespace-only after the agent run, the bot uses
`chore: iterate spec for #<issue>` (today's headline). No comment,
no warning — the iteration still landed, just without the
description. Logged at `info` level for dev observability.

**Rationale**: the summary is a quality-of-life improvement, not
a correctness gate. Missing summary should never block the spec
update.

### 5. Description is read AFTER the agent run, BEFORE `git add -A`

Order in `handleIterateSpec`:

```
runAgent(...)
const summary = readIterateSummary(workdir)  // new
const headline = buildIterateHeadline(issueNumber, summary)  // new
verify(workdir, changeName)
addAll(workdir)         // .openspec-flow/ is gitignored, not staged
commit(workdir, headline)
pushBranch(workdir, branch)
```

`readIterateSummary` is a 10-line file read with trim + truncate.
`buildIterateHeadline` is a 5-line pure function. Both live in a
new `src/handlers/iterate-spec/headline.ts` module with a tiny
unit test surface (formatting, truncation, fallback).

### 6. Gitignore the summary file in the workdir

The bot writes a one-line `.gitignore` in the workdir (or appends
to the existing one) covering `.openspec-flow/` *before* the agent
runs. Belt-and-braces: even if `git add -A` runs first, the file
stays out of the commit.

**Alternative considered**: delete the file after reading it.
Rejected — gitignore is declarative and survives bugs in the
read-order. Deletion is imperative and would re-introduce the
"file leaks into commit" failure mode if the read step errors.

## Risks / Trade-offs

- **Agent refuses to write the summary file** → Mitigation:
  fallback headline. Logged. No retry. The spec rewrite still
  landed; the headline is a cosmetic regression, not a
  correctness one.
- **Agent writes a multi-line summary** → Mitigation: bot takes
  the first non-empty line and truncates at 60 chars. Belt: the
  prompt explicitly says "one line, ≤ 60 chars".
- **Agent writes a summary with markdown / control chars** →
  Mitigation: strip newlines + tabs, collapse repeated spaces,
  truncate. No HTML escape needed (this isn't rendered as HTML).
- **Em dash renders oddly in some terminals / git logs** →
  Mitigation: it's a single UTF-8 codepoint; `git log` and the
  GitHub UI both handle it. Plain ASCII fallback (`--`) was
  considered and rejected — em dash is unambiguous and matches
  the prose style of the rest of the project's PR titles.
- **Agent describes the iteration inaccurately** → Acceptable.
  The headline is a hint, not a contract; the diff is the truth.
- **Future `iterate-impl` writes to the same file path** →
  Intentional. Shared contract means a shared headline.ts util
  later. Out of scope for this change but trivial to lift.

## Migration Plan

Single-step deploy:

1. Land this change. New iterate-spec runs immediately use the
   descriptive headline if the agent writes the file.
2. No rollback path needed — the fallback is the current behaviour.
   If the new path misbehaves, the worst outcome is identical
   headlines (today's status quo).
3. Existing spec PRs (e.g. #31) keep their old headlines. No
   rewrite of git history.

## Open Questions

- Should the summary file path live under `.openspec-flow/`
  (proposed) or `.openspec/` (already a real directory)? **Decision:**
  `.openspec-flow/` to avoid any chance of colliding with the
  openspec CLI's own state.
- Should we also surface the summary in the iterate PR comment
  (`spec updated by openspec-flow — <summary>`)? **Decision:**
  out of scope. The commit headline is enough; PR comment can be
  a follow-up if reviewers ask for it.
