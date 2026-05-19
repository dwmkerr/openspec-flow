# CLAUDE.md

Authoritative definition of the openspec-flow user flow, identity, and label
contract. Every other doc and spec in this repo must stay in sync with this
file. If you change anything in `docs/`, `openspec/specs/`, `public/index.html`,
or `README.md`, check this file first and update it in the same change.

## The flow

Five beats. Two PRs. Discussion optional.

```
Open issue ──► Iterate on spec ──► Review implementation
    │                │                       │
   user          spec PR                  impl PR
   adds          (openspec                (openspec
   openspec:go   :spec)                   :impl)
                 + merge                  + merge
```

1. **User opens an issue** describing a feature, bug, or task and adds the
   `openspec:go` label. Issues can also be created from outside (GH UI, API,
   CLI).
2. **Agent opens a spec PR** labelled `openspec:spec`. The PR contains the
   OpenSpec artifacts (`proposal.md`, `design.md`, `tasks.md`, spec deltas).
3. **User reviews the spec PR**. Optionally comments. To iterate, the user
   adds `openspec:go` to the PR; the agent updates the spec in place.
   When happy, the user merges.
4. **Agent opens an impl PR** labelled `openspec:impl`. Code matches the
   merged spec. Tasks are ticked as work progresses.
5. **User reviews the impl PR**. Optionally comments. To iterate, the user
   adds `openspec:go`; agent updates code in place. When happy, the user
   merges. The issue closes automatically.

Discussion (comments, reviews) is optional at any step. The deterministic
trigger that drives the agent is always `openspec:go`.

## Identity

- **Public-facing name** (used in PR titles, comment bodies, marketing): `openspec`.
- **GitHub App slug** (used in install URLs and bot commits): `openspec-flow` (prod), `openspec-flow-dev-<name>` (per-dev).
- **Bot commit identity**: `openspec-flow[bot]` (prod), the dev App slug for development.
- When the agent posts on a PR or issue, it speaks as `openspec`:
  > openspec: specification has been updated with multi-line handling.

## Labels — the public contract

Three labels. The user applies exactly one. The agent applies the others.

| Label | Applied by | Meaning |
|---|---|---|
| `openspec:go` | **user** | "Run the agent on this issue/PR." Trigger to start the flow or iterate on an open PR. The agent removes it after acting. |
| `openspec:spec` | **agent** | Marks a spec PR. Persistent until the PR closes. |
| `openspec:impl` | **agent** | Marks an implementation PR. Persistent until the PR closes. |

No other openspec-flow labels exist in the user-facing contract. Internal
test labels (e.g. `test:<scenario>`) live in `scripts/` and the CLAUDE.md of
this repo only.

## Triggers — deterministic mapping

Every action the agent takes is determined by event + label state. No
fuzzy intent detection, no body scanning. The trigger is always
`openspec:go` (or a merge event on a lifecycle-labelled PR). Comments
are read by the iterate handlers as context, never as triggers.

| Event | Target state | Intent |
|---|---|---|
| `issues.labeled` with `openspec:go` | issue, no linked spec PR | `create-spec` |
| `pull_request.labeled` with `openspec:go` | PR has `openspec:spec` | `iterate-spec` |
| `pull_request.labeled` with `openspec:go` | PR has `openspec:impl` | `iterate-impl` |
| `pull_request.closed` with `merged: true` | PR has `openspec:spec` | `create-impl` |
| `pull_request.closed` with `merged: true` | PR has `openspec:impl` | `noop` (impl PR includes spec archival; nothing more to do) |
| anything else | — | `noop` |

Noop is either silent (irrelevant event) or visible (trigger looked
right but state was wrong — bot comments with the reason). Examples of
visible noops:

- `openspec:go` on an issue that already has an open spec PR
- `openspec:go` on a PR missing both `openspec:spec` and `openspec:impl`
- `openspec:go` on a closed issue/PR
- `openspec:go` on a PR with both lifecycle labels
- Spec PR closed unmerged
- User manually applies `openspec:spec` or `openspec:impl`

## Linkage — issue ↔ spec PR ↔ impl PR

PRs are linked to issues (and to each other) by an HTML-comment metadata
block in the PR body. Hidden from rendered Markdown, machine-readable,
persists with the PR. The block is auto-maintained by the bot — do not
edit or remove.

**Spec PR body** ends with:

```html
<!-- openspec-flow:auto-maintained — do not remove or edit
issue: 42
kind: spec
change: add-csv-export
-->
```

**Impl PR body** ends with:

```html
<!-- openspec-flow:auto-maintained — do not remove or edit
issue: 42
kind: impl
change: add-csv-export
spec-pr: 43
-->
```

The PR body also contains a visible `Closes #42` line so GitHub auto-closes
the issue when the impl PR merges. The HTML comment is the canonical
linkage source; `Closes #N` is the fallback.

Inspect the metadata by viewing the raw PR body (press `e` to edit the
description, or use `gh pr view <n> --json body -q .body`).

## Branch conventions

The agent uses conventional-commit-style branch prefixes:

| Phase | Branch |
|---|---|
| Spec PR | `chore/<issue-number>-<slug>` |
| Impl PR | `feat/<issue-number>-<slug>` |

The slug is a kebab-case rendering of the issue title. The impl prefix is
`feat` by default; configurability per issue type is on the roadmap (see
`ideas.md`). Branches are auto-deleted on merge.

## Install modes

| Mode | What user does | Where agent runs |
|---|---|---|
| Action (local install) | Drops a reusable-workflow shim into `.github/workflows/openspec-flow.yml` | GitHub Actions runner |
| App (org install) | Installs the openspec-flow GitHub App on the org or repo | Probot service (Fly.io) |

Both modes implement the same flow above. They are functionally equivalent
from the user's perspective.

## What must stay in sync

When any of the following change, update this file in the same commit:

- The flow beats (1–5 above)
- The label contract (names, applied-by, meaning)
- The trigger → intent mapping
- The public identity (`openspec` vs `openspec-flow`)
- The two install modes
- The linkage metadata format (HTML comment schema)
- The branch convention

Files that depend on this contract:

- `README.md` — user-facing summary
- `public/index.html` — the visual mental model
- `docs/architecture.md` — system design
- `docs/developer-guide.md` — dev loop
- `docs/app-setup.md` — App registration
- `openspec/specs/openspec-flow/spec.md` — workflow-mode spec
- `openspec/specs/intent-recognition/spec.md` — classifier spec (created by `wire-intent-recognition`)
- Future per-handler specs

If you find a discrepancy between this file and any of those, treat this
file as the source of truth and update the dependent doc.

## Working style

- Conventional commits (`feat:`, `fix:`, `docs:`, …). See `~/.claude/CLAUDE.md`.
- Comments explain WHY, not WHAT.
- TypeScript strict, Node ≥ 22, CommonJS.
- Tests sit next to source (`*.test.ts`) or under `tests/integration/`.
- `scratch/` is gitignored; use it for research, mockups, lift notes.

## Patterns

- Use `@octokit/webhooks-types` for payload types. Don't hand-roll interfaces.
- Parse structured text (YAML, JSON) with a real parser. Don't reach for regex.
- Test scripts in `tests/scripts/` identify their artefacts by a unique `test:<scenario>` label so runs are isolated and idempotent.
- Probot integration tests need a real 2048-bit RSA key — generate with `crypto.generateKeyPairSync` in `beforeEach`.
- Imports use `.js` suffix (Node16 ESM-style). `jest.config.js` strips them via `moduleNameMapper`.
- `app.on(eventName)` gives typed `Context`. `app.onAny` does not — prefer the former.
- One `.env` file. Prod secrets live in host secret managers, not files.
