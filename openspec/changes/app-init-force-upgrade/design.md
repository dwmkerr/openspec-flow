# Design: app-init-force-upgrade

## Context

The OIDC broker change ships an updated shim template (`id-token: write`). Every repo with an existing shim is stuck on the old template until somebody manually edits it. The CLI's local `install --force` works but requires cloning each target repo. A remote upgrade path via `app-init --force` is the natural complement — same primitive, just bypasses the idempotency guards.

## Goals / Non-Goals

**Goals:**
- One CLI command (`app-init --repo <r> --force`) updates a remote shim from the current template.
- Re-runs are safe: the branch is force-updated; the existing PR auto-picks up the new commits.
- Default behaviour (no flag) unchanged — backwards-compatible with the install handler that runs on `installation.created` / `installation_repositories.added`.

**Non-Goals:**
- Fleet-wide auto-upgrade (Probot scans all installations and opens upgrade PRs). Tracked in #76.
- Drift detection beyond what the planner already provides (workflow byte-compare).
- Self-check inside the reusable workflow that warns "your shim is out of date".

## Decisions

### D1. `force` bypasses both skip-checks

**Decision**: With `force: true`, both the `allNoop → already-initialised` and the `hasOpenInitPR → pr-already-open` short-circuits are skipped. The planner runs with `force: true` so it overwrites managed regions instead of leaving them alone.

**Why**: a user passing `--force` is asserting "re-render from current templates". Honouring the skip-checks would defeat the flag's purpose.

### D2. Existing PR is reused when `pulls.create` returns 422

**Decision**: When `force: true` and `pulls.create` returns 422 (HTTP "Validation Failed", which GitHub uses when an open PR for the same head already exists), `runAppInit` looks up the existing PR via `pulls.list({ head, state: "open" })` and returns its URL. The branch ref is already updated by `writeFiles`' force-update path, so the existing PR's diff is the new content.

**Alternatives considered**:
- Close the existing PR and open a fresh one. Rejected — destroys review history.
- Refuse to proceed and ask the user to close manually. Rejected — defeats the convenience of `--force`.

### D3. PR title + body distinguish upgrade from initial setup

**Decision**: Title becomes `chore: openspec-flow upgrade` (vs `chore: openspec-flow setup`) and the body's lead sentence explains "upgrade — re-renders the shim + managed README regions from the current templates".

**Why**: reviewers seeing the PR in their inbox should know at a glance which scenario this is. The rest of the body (secret setup, label notice, etc.) stays the same since the secret requirements don't change between init and upgrade.

## Risks / Trade-offs

- **Risk**: a user runs `--force` on a repo with hand-edited managed regions. → The planner's `force: true` will overwrite them. **Mitigation**: documented in the flag's help text; markers are explicitly "managed region — do not edit between".
- **Risk**: force-updating the branch while an open PR has unmerged review comments could confuse reviewers. → **Mitigation**: comments are on file lines; force-update creates a new commit on the same branch, which is the normal GitHub workflow for iterating on a PR. No worse than `git push --force` on any feature branch.
- **Trade-off**: no fleet-mode in this change. Users with N repos pay N invocations. Acceptable — the canonical loop is a one-line `for` over the installed repos.

## Migration Plan

1. Land code behind the opt-in flag.
2. Smoke against `dwmkerr/livedown` (which has an outdated shim).
3. Document in `docs/oidc-broker.md` setup as the recommended way to retrofit existing repos.

**Rollback**: revert. Existing behaviour preserved by `force: false` default.

## Open Questions

- **Q1**: Should `--force` also re-create labels via `ensureContractLabels` even if the canonical names already exist? Currently it does — `ensureContractLabels` runs ahead of the skip-check. Acceptable.
- **Q2**: Should the upgrade PR carry a label like `openspec:upgrade` for filterability? Out of scope; the user explicitly wants the label contract kept to three.
