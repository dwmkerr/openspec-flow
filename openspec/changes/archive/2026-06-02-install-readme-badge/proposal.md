## Why

The managed README block tells a reader what openspec-flow is, but gives no live signal of the workflow's health. A standard GitHub Actions status badge at the top of the block links the reader to the target repo's Actions tab and shows pass/fail at a glance.

## What Changes

- `install` resolves the target repo's `owner/name` from the cwd's `origin` remote (best-effort, both https and ssh URL forms).
- When resolved, the rendered README block opens with a workflow-status badge pointing at `https://github.com/<owner>/<name>/actions/workflows/openspec-flow.yml`. When unresolvable (no origin, non-GitHub, git absent), the badge is omitted and the block renders as before.
- No new remote writes or network calls.

## Capabilities

### Modified Capabilities

- `install`: extend the README managed-block requirement — when the target repo's GitHub remote resolves, the block opens with the workflow-status badge.

## Impact

- **Affected code**: `src/install/detect.ts` (new `resolveRemote(cwd)`), `src/install/templates.ts` (badge line, optional `remote` arg on `renderReadmeBlock`/`renderMinimalReadme`), `src/install/plan.ts` (resolve once, pass through).
- **Compatibility**: existing managed blocks refresh on `--force`; otherwise unchanged (per the install three-state model).
