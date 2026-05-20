## Context

Today's architecture (`docs/architecture.md`) ships two install modes that share
core logic:

| Mode | Where work runs | Identity | Hosting cost |
|---|---|---|---|
| A — Action | Target repo's runner | App installation token | $0 (public repos) |
| B — App (Probot) | Fly.io service we own | Probot process w/ JWT | ~$3–7/mo per region + ops |

Mode B clones the target repo onto a service we operate, runs the agent there,
then pushes back. That works, but it creates a parallel runtime, a parallel auth
path, and an operational tail (logs, restarts, secret rotation, region picks)
that grows with adoption.

Issue #26 challenges the premise. Everything the bot does today — checking
labels, cloning the repo, running Claude, opening PRs, leaving comments — can
happen inside a GitHub Actions runner in the target repo, with `workflows: write`
unlocked by an App installation token. If that's true, openspec-flow can collapse
into:

- a thin shim (a workflow file plus optional config) inside each target repo,
- a CLI / App that installs and upgrades the shim, and
- a reusable workflow in *this* repo that the shim calls.

This change is the RFC. It enumerates the candidate strategies, lays out a
selection rubric, and locks in the contract between this repo and the shim files
it owns inside target repos.

## Goals / Non-Goals

**Goals:**

- Enumerate at least five candidate shimming strategies covering the design
  space (no infra, App-as-installer, scaffolder CLI, fat shim, manifest-only).
- Define the agent identity model in the shim world. Make it explicit that
  identity comes from the App installation token regardless of where the
  process runs.
- Define the shim's lifecycle: install, upgrade, drift detection, removal.
- Define the contract this repo offers: the reusable workflow signature, the
  inputs/secrets it accepts, the version pinning convention.
- Define the App's job in shim mode: install → open shim PR → close.
- Capture an evaluation rubric (cost, latency, UX, security, ops) so a later
  change can pick a single strategy with explicit reasons.

**Non-Goals:**

- Picking a single strategy. That happens in a follow-on change once this RFC
  lands.
- Building the App's installer-PR flow. That's a separate capability.
- Deleting or refactoring the Probot service. The Probot path stays usable.
- Adding handler code, composite actions, or workflow files. This change is
  spec-only.
- Changing existing label semantics or the `openspec:go` trigger contract.

## Decisions

### Decision 1: Treat "shim distribution" as its own capability

Why: today the shim lives implicitly inside Mode A's docs and a one-off snippet
in the README. As soon as we say "the App opens a PR that adds a shim" and "the
CLI updates the shim" and "the agent's identity comes from the shim's App token",
the shim is the contract — it needs requirements, scenarios, and a spec file of
its own.

Alternatives considered:

- *Stuff it into the existing `openspec-flow` spec.* Rejected: that spec covers
  workflow lifecycle (plan/implement/respond jobs), not distribution. Mixing
  them would make both harder to evolve.
- *Document it only in `docs/architecture.md`.* Rejected: docs drift. A
  capability spec keeps the contract testable.

### Decision 2: Five candidate strategies — keep all on the table

Lay out each as a peer; let the rubric choose.

**S1 — Thin reusable-workflow shim (today's Mode A, formalised).**
Target repo holds `.github/workflows/openspec-flow.yml` that does
`uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v1`. Nothing
else. All logic lives here. Shim is ~15 lines.

```yaml
# target repo: .github/workflows/openspec-flow.yml
name: openspec-flow
on:
  issues: { types: [labeled] }
  pull_request: { types: [labeled, closed] }
  issue_comment: { types: [created] }

jobs:
  flow:
    uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v1
    secrets:
      ANTHROPIC_API_KEY:         ${{ secrets.ANTHROPIC_API_KEY }}
      OPENSPEC_FLOW_APP_ID:      ${{ secrets.OPENSPEC_FLOW_APP_ID }}
      OPENSPEC_FLOW_PRIVATE_KEY: ${{ secrets.OPENSPEC_FLOW_PRIVATE_KEY }}
```

Pros: zero infra, free on public repos, transparent (user sees what runs).
Cons: 20–60s cold start; user has to add three secrets manually.

**S2 — App-as-installer.**
User installs the GitHub App once. The App's *only* job is to open a PR against
the target repo's default branch that adds the shim workflow and (optionally)
provisions the three secrets via the org's secret-management endpoints. After
that PR merges, the App goes idle. Real work always runs in the target repo's
Actions runner.

Pros: one-click install, App owns the upgrade story, no hosted runtime needed
for actual work. Cons: App still needs a webhook endpoint to receive
`installation_repositories` events; either ship that on a tiny serverless
function (Cloudflare Worker / Vercel) or host it on Fly.io but as a stateless
PR-opener with no per-request hot path.

**S3 — npm scaffolder.**
Ship `npx @dwmkerr/openspec-flow init`. The command writes the shim workflow,
runs `gh secret set` for the three secrets if the user has them, and prints an
"install the App on this repo" URL. No service to host.

Pros: dev-friendly, runs locally, no hosting at all. Cons: harder to upgrade
(user has to remember to re-run); discoverability is lower than the App listing
on GitHub.

**S4 — Fat workflow shim (no this-repo dependency).**
Target repo's workflow file inlines the orchestration — checkout, install
openspec CLI, install Claude Code Action, run agent, open PR. Nothing under
`dwmkerr/openspec-flow/.github/workflows/*` is referenced.

Pros: target repo is fully self-contained, no version drift surface; users can
fork the workflow and modify freely. Cons: every fix to the workflow has to
ripple to every target repo via a re-shim PR; reusable-workflow benefits lost.
This is the *opposite* of shimming.

**S5 — Manifest-only.**
Target repo holds `openspec-flow.yaml` (a small config: which Anthropic model,
which intent classifier, branch prefixes). The shim workflow reads it. The App
or scaffolder generates only the manifest; the workflow file is generated by
this repo's release artefacts and re-injected by the App on each release.

Pros: smallest target-repo footprint (one short YAML, no workflow file edits
ever); upgrades are invisible to users. Cons: the App needs `workflows: write`
indefinitely on every install, not just at install-time. Bigger trust ask.

### Decision 3: Identity model — App token, always

Whatever the strategy, the agent's identity is the App installation token, not
the runtime. Concretely:

| Strategy | Where token is minted | Used by |
|---|---|---|
| S1 thin shim | `actions/create-github-app-token` step inside the reusable workflow | `gh` calls, `git push`, `actions/checkout` |
| S2 App-as-installer | Same as S1 for normal flow; App's own installer flow uses its own installation token (different installation context maybe) | Same |
| S3 scaffolder | Same as S1 | Same |
| S4 fat shim | Same as S1, but minted in the target repo's copy of the workflow | Same |
| S5 manifest-only | Same as S1 | Same |

This is the key insight from the RFC: the App is the identity provider, not the
runtime. The Probot service in today's Mode B happens to *also* be the runtime,
but that's not required. Decoupling identity from runtime is what makes shimming
possible.

Consequence: `openspec-flow[bot]` is the commit author and PR opener in every
mode, because every mode resolves to "App installation token in a runner",
whether the runner is GitHub Actions (shim) or our service (Probot).

### Decision 4: Shim lifecycle

Four operations the shim must support:

| Operation | Trigger | Owner |
|---|---|---|
| Install | App install OR `openspec-flow init` OR manual copy-paste | App / CLI / user |
| Upgrade | New release in `dwmkerr/openspec-flow` OR `openspec-flow shim upgrade` OR App-driven PR | App / CLI |
| Drift detect | CI on `dwmkerr/openspec-flow` releases comments on target repos using outdated shims | App (later) |
| Remove | Uninstall App OR `openspec-flow shim remove` | App / CLI / user |

Drift detection is explicitly punted to a follow-on change. The other three are
in scope for whatever strategy wins.

### Decision 5: Version pinning convention

Shims pin to a major (`@v1`), not a tag. Release-please maintains a moving `v1`
tag. Breaking changes bump to `v2` and the App opens an upgrade PR. This matches
GitHub Actions community convention (`actions/checkout@v4`) and means most users
never re-shim within a major.

Alternatives considered:

- *Pin to SHA*. Rejected: maximally safe but creates a manual upgrade for every
  bug fix; defeats the point of a shim.
- *Pin to exact tag*. Rejected: same problem at lower friction.
- *Pin to `@main`*. Rejected: surprise breakage; bad practice.

### Decision 6: Evaluation rubric

Score each strategy on six axes. The winning strategy isn't necessarily best on
every axis; it's the one with the best overall profile.

| Axis | What we measure |
|---|---|
| Install friction | Number of steps the user takes from zero to first spec PR |
| Run latency | Time from `openspec:go` label to first agent action |
| Operating cost | Hosting bill + ops time per month at 10, 100, 1000 installs |
| Security surface | What permissions the App needs, for how long, on how many repos |
| Upgrade UX | What the user does when v2 ships |
| Transparency | Can a user read the workflow and understand what's happening? |

A follow-on change will fill in this rubric per-strategy with evidence and pick
one.

## Risks / Trade-offs

- **Risk: This RFC becomes a parking lot.** → Mitigation: scope is tight to
  spec-only changes. The follow-on selection change is named in the proposal and
  is the obvious next step. No code lands until that selection happens.

- **Risk: We pick "shim everywhere" and then discover something genuinely needs
  a server (e.g., scheduled jobs, cross-repo coordination).** → Mitigation: the
  capability spec explicitly says "App is the identity provider, not the
  runtime", which leaves the Probot service available as one possible runtime
  among many. We can run a server for the things that need it without forcing
  all work onto a server.

- **Risk: App installation token rotation breaks long-running agent steps.** →
  Mitigation: installation tokens last 1 hour. Mint at the start of each job.
  Document that any single job that exceeds 1 hour needs a refresh step.

- **Risk: Shim drift across hundreds of target repos.** → Mitigation: this
  change defines drift detection as a follow-on capability; not solving it yet,
  but the strategy choice will weight upgrade UX, which is the same problem in
  a different frame.

- **Trade-off: Five strategies is a lot to keep coherent.** → Accepted. The
  alternative (cull to two before research) commits us before we understand the
  axes. The spec lists the strategies; the rubric narrows them.

## Migration Plan

This change is spec-only. No code changes, no rollback needed.

Sequence:

1. This change lands (proposal, design, spec delta, tasks).
2. A follow-on change `select-shim-strategy` fills the rubric, picks a winner,
   and amends the `shim-distribution` spec with requirements specific to the
   chosen strategy.
3. Implementation changes follow per chosen strategy. Likely candidates:
   `add-shim-installer-app` (S2), `add-openspec-flow-init-cli` (S3),
   `formalise-thin-shim-workflow` (S1).

## Open Questions

1. **Does S2 (App-as-installer) need a webhook endpoint at all, or can the App
   open the install PR using Actions on its own infrastructure?** GitHub Apps
   without a webhook URL are legal — they exist purely to mint tokens. If the
   install PR can be opened by an Action in *this* repo triggered by an
   `installation_repositories` webhook routed via GitHub's UI hooks, we may not
   need any hosted service at all.
2. **Does the org-secret-provisioning step in S2 work without org-admin
   permissions?** Likely no for org-level secrets, yes for repo-level secrets
   with `secrets: write`. This shapes the UX significantly.
3. **What happens to the existing Probot scaffolding in `src/`?** Probably stays
   as one possible runtime; the spec is agnostic. But the Phase 2 roadmap in
   `docs/architecture.md` likely needs revising.
4. **Should S1 (thin shim) and S2 (App-as-installer) be merged?** The thin shim
   is the *artefact*; the App-as-installer is the *delivery mechanism* for that
   artefact. They might be one strategy with two install paths.
5. **Does Claude Code Action's `workflow_call` interaction handle re-entrant
   jobs cleanly?** The shim triggers the reusable workflow; if the agent in
   that workflow needs to update the shim itself, can it open a PR against the
   target repo's workflow file without recursive triggers? Needs spike.
