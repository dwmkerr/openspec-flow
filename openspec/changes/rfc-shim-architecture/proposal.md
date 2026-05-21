## Why

The current architecture ships two install modes — a reusable GitHub Action (Mode A)
and a self-hosted Probot App (Mode B). The Probot mode forces us to run, monitor, and
pay for infrastructure (Fly.io service, build pipeline, secret store, logs). Every
target repo we onboard widens that surface even though the actual work — cloning,
running the agent, opening PRs — is just as well suited to a GitHub Actions runner.

Issue #26 asks: can we collapse to a shim-only model where the App is essentially a
*distribution and identity* mechanism, while all execution happens inside the target
repo's Actions runner? This RFC explores that question, evaluates alternatives, and
proposes a direction.

## What Changes

This change does not yet remove the Probot path. It establishes the shim-first
architecture as the canonical model, captures the contract a shim must satisfy, and
records the App-as-identity-only stance so downstream changes can extract the
runtime out of Probot in subsequent PRs.

- Define the **shim** as a versioned reusable-workflow stub that lives in the target
  repo at `.github/workflows/openspec-flow.yml` and `uses:` the centrally-published
  reusable workflow in `dwmkerr/openspec-flow`.
- Specify what the App installation does on install: it opens an **initial shim PR**
  against the target repo adding the shim file, the three labels, and a one-line
  `README` snippet. The user merges to opt in.
- Define the **CLI** (`npx @dwmkerr/openspec-flow init`) as the offline / preview path
  that writes or updates the same shim file. It also surfaces secret state
  (presence of `ANTHROPIC_API_KEY`, App credentials) and emits an optional
  `.openspec-flow.yaml` for local configuration. Useful for repos without the
  App installed, for dry-runs (executable under `act`), and for CI smoke tests.
- **Drift detection is deferred.** This RFC notes drift as a follow-up only; a
  GitHub issue captures the design (daily check, single-PR-per-installation
  idempotency, bump-only on the `@v<n>` token). No drift requirement ships in
  this change.
- Carry the App-token mint (`actions/create-github-app-token`) inside the reusable
  workflow so the runner gets `workflows: write` and the agent commits attribute to
  `openspec-flow[bot]`. The user no longer needs to provision `OPENSPEC_FLOW_APP_ID`
  and `OPENSPEC_FLOW_PRIVATE_KEY` per-repo — they flow from the installation.
- **BREAKING (post-extraction):** the Probot Fly.io service is retired as the
  primary execution surface. Probot survives only as a webhook-to-`workflow_dispatch`
  bridge if we keep it at all (see Open Questions).

## Capabilities

### New Capabilities
- `shim-distribution`: defines the shim file format, the install-time PR, the
  `init` CLI command that writes/updates the shim and validates secrets, and
  the identity contract (which actor opens the PR, what label is applied, what
  commit author is used). Drift detection is intentionally out of scope and
  tracked as a follow-up issue.

### Modified Capabilities

None. `openspec-flow` and the handler specs describe behaviour *given* a workflow
is running; the shim is upstream of all of them. No existing requirement changes.

## Impact

- **Affected docs**: `docs/architecture.md` (install modes section), `docs/app-setup.md`
  (install flow), `README.md` (install summary), `public/index.html` (mental model).
- **Affected code**: new `src/shim/` module owning the shim template and CLI command;
  new `src/handlers/install/` handler responding to the `installation.created` and
  `installation_repositories.added` webhooks; possible removal of long-running
  Probot handlers once execution lives entirely in Actions.
- **APIs**: the App needs `Contents: Write` + `Pull requests: Write` +
  `Workflows: Write` permissions (already documented in `app-setup.md`) — no new
  permission surface.
- **Infrastructure**: opens the door to retiring the Fly.io deployment. Out of scope
  for *this* change but unblocked by it.
- **Dependencies**: no new runtime deps. Consumes `@octokit/app`,
  `actions/create-github-app-token@v1`, the existing reusable-workflow YAML.
