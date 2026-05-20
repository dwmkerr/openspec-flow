## Why

Issue #26 is an RFC asking how openspec-flow should be installed into target repos.
Today the default plan assumes a Probot service that clones target repos and runs
the agent on rented infrastructure (Fly.io). That carries a permanent hosting bill,
a secrets-management burden, and a parallel auth path that diverges from the Action
mode. The user's hypothesis: if all real work happens inside GitHub Actions runners
in the *target* repo, openspec-flow can be a thin shim — a single reusable-workflow
file (and maybe a config file) maintained by the agent itself. No hosting, no
clones, no separate runtime; just a workflow file that calls back into this repo.

This change does **not** pick an answer. It captures the design space, lists the
candidate shimming strategies, and locks in evaluation criteria so the next change
can choose one with eyes open.

## What Changes

- Add a new `shim-distribution` capability that defines the contract between
  openspec-flow and a target repo's `.github/workflows/` directory.
- Document, side by side, five candidate shimming strategies (App-as-installer,
  thin workflow shim, fat workflow shim, npm scaffolder, manifest-only) with
  trade-offs.
- Define what "installing the App" does in the shim world: open a PR against the
  target repo that adds/updates the shim workflow file and any required config,
  rather than spinning up a Probot service that owns the work.
- Define how the agent's identity is bound to the App across modes — the shim
  runs as `openspec-flow[bot]` because it uses an App installation token via
  `actions/create-github-app-token`, not because a Probot process holds the key.
- Define how the CLI updates a target repo's shim (`openspec-flow shim upgrade`)
  and how the App opens a PR when a new shim version ships.
- Capture the explicit non-decisions: this change does **not** delete the Probot
  path, does **not** retire Mode B, and does **not** change any existing handler.
  It only widens the architecture doc and adds a capability spec so a follow-on
  change can pick one path and execute.

## Capabilities

### New Capabilities

- `shim-distribution`: how openspec-flow is delivered into a target repo, what
  the shim contains, who maintains it, and how the agent's identity is bound to
  the App when work runs on a GitHub-hosted runner instead of a hosted service.

### Modified Capabilities

<!-- Intentionally empty. This RFC introduces a new capability spec; it does not
     yet change requirements on existing capabilities. A follow-on change will
     update `openspec-flow`, `create-spec-handler`, and `create-impl-handler`
     once a shim strategy is chosen. -->

## Impact

- `docs/architecture.md`: gains a "Shim model" section that links to the new
  capability spec.
- `README.md` install instructions stay accurate; no user-visible change yet.
- No code changes in `src/`. No changes to existing handlers or composite actions.
- No CI changes. No new dependencies.
- Downstream: a follow-on change can either (a) re-scope Phase 2 around shim
  distribution and shrink/retire the Probot service, or (b) keep Probot and add
  the shim path beside it. This proposal keeps both doors open.

## What this unlocks

- This change: `explore-shim-architecture` — adds the `shim-distribution`
  capability spec, enumerates five candidate strategies, locks in the
  evaluation rubric, and leaves Mode A and Mode B unchanged.
- Follow-on: `select-shim-strategy` — scores the five strategies against
  the rubric, picks a single winner, and amends the
  `shim-distribution` spec with strategy-specific install/upgrade/remove
  requirements. Stub created alongside this change at
  `openspec/changes/select-shim-strategy/`.
- After selection lands, the chosen-strategy implementation change
  (likely one of `add-shim-installer-app`,
  `add-openspec-flow-init-cli`, or `formalise-thin-shim-workflow`) ships
  the code that actually distributes the shim into target repos.
