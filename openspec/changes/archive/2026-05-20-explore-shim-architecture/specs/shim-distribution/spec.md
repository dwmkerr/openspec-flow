## ADDED Requirements

### Requirement: Capability defines the shim contract

The `shim-distribution` capability SHALL define the contract between
openspec-flow and a target repository's `.github/workflows/` directory.
The contract SHALL cover what the shim contains, who maintains it, how it
is installed and upgraded, and how the agent's identity is established
when work runs on a GitHub-hosted runner rather than on a hosted
service.

The capability SHALL be agnostic to the chosen distribution strategy. It
SHALL enumerate at least five candidate strategies and SHALL NOT mandate
one. A follow-on change is required to pick one strategy and add
strategy-specific requirements.

#### Scenario: Capability spec exists and is discoverable
- **WHEN** `openspec/specs/shim-distribution/spec.md` is read after this
  change archives
- **THEN** the file exists and lists the candidate strategies and the
  contract surface (shim file location, version pinning, identity model)

#### Scenario: Capability spec mandates no strategy yet
- **WHEN** the spec is searched for requirements that mandate a specific
  strategy (S1 thin, S2 App-installer, S3 npm scaffolder, S4 fat, S5
  manifest-only)
- **THEN** none are present; only the contract surface and rubric are
  required

### Requirement: Candidate strategies are enumerated

The capability SHALL enumerate the following candidate shimming
strategies, each with a description, primary trade-off, and a worked
example of what the user installs into the target repo:

1. **S1 — Thin reusable-workflow shim.** Target repo holds
   `.github/workflows/openspec-flow.yml` that delegates to
   `dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@v1`.
2. **S2 — App-as-installer.** The GitHub App opens a PR against the
   target repo that adds the shim and provisions secrets. The App
   itself does not run the agent.
3. **S3 — npm scaffolder.** `npx @dwmkerr/openspec-flow init` writes
   the shim locally, sets repo secrets via `gh secret set`, and prints
   an App install URL.
4. **S4 — Fat workflow shim.** The target repo's workflow file inlines
   all orchestration; no `uses:` dependency on this repo.
5. **S5 — Manifest-only.** Target repo holds a small
   `openspec-flow.yaml` config; the workflow file is regenerated on
   each release by the App.

#### Scenario: All five strategies are documented
- **WHEN** the spec is read
- **THEN** each strategy S1–S5 has a name, a one-paragraph description,
  a primary trade-off, and at minimum one snippet showing what the
  target repo holds

#### Scenario: New strategies may be added later
- **WHEN** a follow-on change adds a sixth strategy
- **THEN** it does so by ADDING to the enumerated list, not by
  REPLACING it

### Requirement: Identity is bound to the App installation token

The capability SHALL state that the agent's identity (`openspec-flow[bot]`
in production, `openspec-flow-dev-<name>[bot]` in dev) is established by
minting an App installation token at job start, regardless of which
strategy is chosen and regardless of where the runtime executes.

The App SHALL be the identity provider. The runtime SHALL NOT be
constrained to live in any specific environment (GitHub-hosted runner,
self-hosted runner, Probot service on Fly.io, or any future host). Any
runtime that holds the App's installation token and runs `git` and `gh`
with it produces commits authored by `openspec-flow[bot]`.

#### Scenario: Token minted per job
- **WHEN** a shim job starts in a target repo's runner
- **THEN** the workflow calls `actions/create-github-app-token@v1` (or
  equivalent) using `OPENSPEC_FLOW_APP_ID` and
  `OPENSPEC_FLOW_PRIVATE_KEY` secrets, and uses the resulting token for
  all subsequent `git push` and `gh` calls

#### Scenario: Identity is the same across modes
- **WHEN** the same App opens a PR in target repo `foo` via the
  reusable-workflow shim AND in target repo `bar` via the Probot
  service
- **THEN** both PRs are authored by the same `openspec-flow[bot]` user
  and trigger the same App-installed branch protections

### Requirement: Shim lifecycle operations are defined

The capability SHALL define four shim lifecycle operations and identify
which actor performs each:

| Operation | Triggers | Performed by |
|---|---|---|
| Install | App install on a repo, OR `openspec-flow init` CLI run, OR user copy/paste from README | App / CLI / user |
| Upgrade | New release tag on `dwmkerr/openspec-flow` major bump, OR `openspec-flow shim upgrade`, OR App-driven PR | App / CLI |
| Drift detect | CI on `dwmkerr/openspec-flow` releases SHALL emit a list of installations on outdated shims; alerting is out of scope for this change | App (later) |
| Remove | App uninstall on a repo, OR `openspec-flow shim remove` | App / CLI / user |

Drift detection alerting is explicitly deferred to a follow-on change.
Install, upgrade, and remove SHALL be in scope for whichever strategy is
selected.

#### Scenario: Install adds the shim file
- **WHEN** an install operation runs against a target repo
- **THEN** `.github/workflows/openspec-flow.yml` (or, for S5, the
  equivalent manifest) exists in the target repo on a branch ready to
  merge

#### Scenario: Upgrade replaces only the shim
- **WHEN** an upgrade operation runs against a target repo currently
  pinned to a major version older than the latest
- **THEN** the shim file is replaced in a PR titled
  `chore: upgrade openspec-flow shim to <new-major>`; no other file in
  the target repo is touched

#### Scenario: Remove deletes the shim file
- **WHEN** a remove operation runs against a target repo
- **THEN** the shim file is deleted in a PR titled
  `chore: remove openspec-flow shim`; the App is left installed unless
  the user uninstalls separately

### Requirement: Shim pins to a moving major version

A shim that points at this repo's reusable workflow SHALL pin to a
major-version tag (e.g. `@v1`), not a SHA or a branch. The
`dwmkerr/openspec-flow` repo SHALL maintain the moving major tag via
release-please.

Breaking changes SHALL bump the major version. When the major bumps,
upgrade SHALL be opt-in: the App or CLI opens an upgrade PR, but a
target repo that does not merge the PR continues to run on the old
major until they choose to merge.

#### Scenario: New minor version requires no shim PR
- **WHEN** `dwmkerr/openspec-flow` ships a non-breaking release (e.g.
  v1.4.0 over v1.3.0) and the moving `v1` tag advances
- **THEN** target repos pinned to `@v1` pick up the new release on
  their next workflow run with no shim file changes

#### Scenario: New major version produces an upgrade PR
- **WHEN** `dwmkerr/openspec-flow` ships a breaking release (v2.0.0)
- **THEN** the App or CLI MAY open a PR against the target repo
  changing the shim's `@v1` to `@v2`; that PR is reviewed and merged at
  the target repo's pace

### Requirement: Evaluation rubric is published

The capability SHALL publish an evaluation rubric that the follow-on
strategy-selection change MUST score each candidate strategy against.
The rubric SHALL include at minimum these axes:

| Axis | Definition |
|---|---|
| Install friction | Number of steps from zero to first spec PR |
| Run latency | Time from `openspec:go` label to first agent action |
| Operating cost | Hosting + ops cost per month at 10, 100, 1000 installs |
| Security surface | App permissions required, scope, duration, blast radius |
| Upgrade UX | What the user does on a major-version bump |
| Transparency | Can a user read the shim and understand what runs? |

The follow-on change SHALL produce a filled rubric (one row per
strategy, each cell with evidence) and SHALL pick a winner with
explicit reasons.

#### Scenario: Rubric exists in the capability spec
- **WHEN** the spec is read
- **THEN** the rubric table above is present with definitions, but
  rows-per-strategy are unfilled (filling is the follow-on change's
  job)

#### Scenario: Strategy selection cites the rubric
- **WHEN** a future change picks a strategy
- **THEN** that change's design.md cites scores against this rubric;
  picking a strategy without scoring SHALL be rejected at review

### Requirement: Existing modes are preserved during this change

This change SHALL NOT remove, deprecate, or modify any existing
behaviour of the current Mode A (reusable-workflow shim) or Mode B
(Probot App) install paths. The two modes continue to work as
documented in `docs/architecture.md` until a follow-on change
explicitly retires one.

#### Scenario: Probot service keeps working
- **WHEN** this change archives
- **THEN** the Probot service in `src/` still builds, still receives
  webhooks, and still opens PRs identically to before

#### Scenario: Reusable workflow keeps working
- **WHEN** this change archives
- **THEN** `dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml`
  still functions as a callable reusable workflow with no signature
  change
