## Context

Today the project ships two install modes (see `docs/architecture.md`):

- **Mode A — Action install**: target repo holds a thin `.github/workflows/openspec-flow.yml`
  that calls `uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v1`.
  Execution happens on the target repo's runner.
- **Mode B — App install**: `openspec-flow` registered as a GitHub App on Fly.io.
  Webhooks land on Probot, which clones the repo, runs Claude, and pushes a PR.
  Execution happens on Fly.io.

The issue raises three threads:

1. We pay an ongoing infra cost (Fly.io, secret store, log retention, scaling) for
   work that Actions can do for free on public repos.
2. The shim itself — a tiny YAML stub — is the *real* product surface a user sees.
   Owning it deliberately (versioned, App-managed, drift-detectable) matters more
   than how the runtime is hosted.
3. Identity. We want commits to look like `openspec-flow[bot]` regardless of which
   mode runs the agent. That demands an App, but it does not demand a Probot
   service — App tokens can be minted from inside an Action.

This RFC asks: should we treat the shim as the canonical install artefact and let
the App's job be limited to *managing the shim* + *issuing tokens*, rather than
running the agent itself?

## Goals / Non-Goals

**Goals:**
- Decide the canonical install model going forward.
- Define what "the shim" is, what it contains, and how it is maintained.
- Define which actor (user, App, CLI) owns each stage of the shim lifecycle —
  install, update, drift detection, removal.
- Capture the identity contract so commits and PRs always attribute to
  `openspec-flow[bot]` (when the App is installed) and a clear fallback when not.
- Decide what — if anything — Probot continues to do.

**Non-Goals:**
- Implementing the shim. This RFC documents the architecture and adds requirements.
  A follow-up change executes them.
- Retiring Fly.io. Same — covered by a follow-up change. This RFC only unblocks it.
- Designing a marketplace listing or onboarding website.
- Multi-tenant pricing or quota model.

## Decisions

### Decision 1: The shim is a versioned reusable-workflow stub, owned by the App

**Chosen**: `.github/workflows/openspec-flow.yml` in the target repo. ~30 lines.
Pinned to a tag: `uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v0.2.0`.

Alternatives considered:

- **A composite-action shim** (`uses: dwmkerr/openspec-flow@v1` inside a workflow
  the user writes themselves). Rejected: pushes triggers, permissions, and env onto
  the user. The whole point is the user writes nothing.
- **A `workflow_dispatch`-only shim** that Probot fires by API. Rejected: re-introduces
  the Probot service as a hard dependency and burns one extra round trip per event.
- **No shim, App-only**: user installs the App, Probot runs everything. Rejected:
  that's the current Mode B which is exactly what we're trying to back away from.

### Decision 2: Three actors can mutate the shim — App, CLI, human

| Actor | When | What it does |
|---|---|---|
| App install event | `installation.created` / `installation_repositories.added` | Opens a PR adding the shim, the three labels, and a snippet in `README.md`. PR body explains opt-in. |
| App drift check (periodic) | once per day per installation | If `@v<ref>` in the target repo is older than the latest published tag, opens a PR bumping it. Idempotent — no duplicate PRs. |
| CLI (`npx @dwmkerr/openspec-flow shim`) | manual | Writes or updates the shim locally; no App needed. Used for previews, smoke tests, and repos that don't want the App. |
| Human | manual | Edits the YAML directly. Drift check respects this — does not overwrite hand-edited fields outside the `uses:` line. |

### Decision 3: Identity is App-derived; runtime is Actions-hosted

The App's two jobs:

1. **Mint installation tokens** so the runner can push commits authored by
   `openspec-flow[bot]` and modify `.github/workflows/*.yml` (which the default
   `GITHUB_TOKEN` cannot do).
2. **Open PRs to manage the shim** on install and drift.

The App does **not** clone repos, does **not** run Claude, does **not** open the
spec/impl PRs. Those happen on the Actions runner.

If the App is not installed, the workflow falls back to `GITHUB_TOKEN` with two
limitations: commits authored by `github-actions[bot]`, and inability to update
the shim file. The bot still works; it just can't self-update.

### Decision 4: Probot survives only as a webhook bridge — and only if needed

Without Probot, the App can still:

- React to install events (install handler runs as a tiny Cloudflare Worker or a
  long-lived Action in `dwmkerr/openspec-flow` listening to a `repository_dispatch`
  / `installation` webhook).
- Run the daily drift check as a scheduled workflow in `dwmkerr/openspec-flow`
  itself, fanning out across installations via the GitHub App API.

The remaining question is whether *runtime triggering* (issue labelled, PR
commented) needs a bridge. Answer: **no**. The shim's `on:` block subscribes to
those events directly. The App doesn't need to forward anything.

So **Probot is removable**. We keep it as long as Mode B has users, then deprecate.

### Decision 5: Shim contents are minimal and stable

Shim file:

```yaml
# Maintained by openspec-flow. Edit at your own risk.
# Docs: https://github.com/dwmkerr/openspec-flow
name: openspec-flow
on:
  issues:
    types: [labeled]
  pull_request:
    types: [labeled]
  pull_request_review_comment:
    types: [created]
  issue_comment:
    types: [created]
jobs:
  flow:
    uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v0.2.0
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      OPENSPEC_FLOW_APP_ID: ${{ secrets.OPENSPEC_FLOW_APP_ID || '' }}
      OPENSPEC_FLOW_PRIVATE_KEY: ${{ secrets.OPENSPEC_FLOW_PRIVATE_KEY || '' }}
```

The only field that changes between versions is the `@v<n>` ref. Drift detection
parses *only* that token.

Alternative considered: pin to a SHA. Rejected — SHA pinning is the right answer
for security-paranoid orgs but kills the auto-bump workflow. Offer SHA pinning as
an opt-out flag on the CLI for those who want it.

### Decision 6: One capability spec, not three

The shim, the install PR, the drift PR, and the CLI all serve one user-visible
concern: "how does my repo get and stay wired up". They share fields, labels,
metadata, and identity rules. One spec captures the contract; future changes will
modify it as the shim format evolves.

## Risks / Trade-offs

- **[Risk] Users may merge the install PR but forget to add secrets.** → The
  reusable workflow's preflight already fails loudly when `ANTHROPIC_API_KEY` is
  empty. Document on the install PR body.
- **[Risk] Drift bot opens noisy PRs.** → Daily check, one PR per installation
  open at a time, body reuses the same marker comment so a re-run edits the
  existing PR instead of opening a new one.
- **[Risk] App permissions creep when we add features.** → Pin to the current
  permission set in the App registration spec; any addition is a new RFC.
- **[Risk] CLI and App write conflicting shims.** → The CLI writes the same
  template the App writes. Both are idempotent on the `@v<n>` line. Hand edits
  outside `uses:` are preserved by both.
- **[Trade-off] Losing Probot means losing sub-10s response.** → Actions adds
  20–60s cold start. For an async bot opening PRs, this is acceptable. The dev
  loop still uses `smee + tsx watch` for local testing.
- **[Trade-off] Public-repo only for free.** → Self-hosted runners or paid
  Actions minutes cover private repos. Document the cost story; do not eat it
  ourselves.

## Migration Plan

This RFC ships as a spec-only change. No code lands. The implementation flows
through subsequent OpenSpec changes:

1. **`shim-cli`**: ship `npx @dwmkerr/openspec-flow shim` (write + update file).
2. **`shim-install-handler`**: App webhook handler that opens the install PR.
3. **`shim-drift-detector`**: scheduled workflow that opens drift PRs.
4. **`retire-probot-runtime`**: remove handlers from the Probot service, leaving
   only the install/drift handlers. Optionally migrate those to a Worker.

Rollback for each: revert the change; targets that already merged the shim PR
keep working because the reusable workflow they `uses:` is unchanged.

## Open Questions

1. **Where do install-handler webhooks land if not Probot on Fly.io?** Cloudflare
   Worker is the cheap obvious answer. Alternative: a GitHub-hosted scheduled
   workflow polls the App's installations list once a minute. Both work; needs a
   benchmark.
2. **Does the install PR include a `.env.example` for `ANTHROPIC_API_KEY`, or
   just instructions?** Lean instructions — `.env` files in the repo are an
   anti-pattern for secrets.
3. **Do we ship the same shim for org-level vs repo-level installs?** Yes —
   shim lives per-repo regardless. Org install just fans out the install PR
   across selected repos.
4. **Do we publish the composite actions as separate `@v1` actions** so advanced
   users can stitch their own workflow? Not yet; would 3× the support surface.
   Revisit after the shim ships.
5. **Versioning policy for the `@v<n>` ref**: major-pinned (`@v1`), minor-pinned
   (`@v1.2`), or exact-pinned (`@v1.2.3`)? Lean minor-pinned with drift bot
   bumping the minor automatically and surfacing major bumps as a separate
   "breaking" PR.
