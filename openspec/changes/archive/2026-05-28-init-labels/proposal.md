## Why

The openspec-flow flow is triggered by the user applying the `openspec:go` label. If that label does not exist on the target repo, the user can't pick it. The agent-applied labels (`openspec:spec`, `openspec:impl`) auto-create on first apply but land grey with no description. `openspec-flow init` should make label readiness obvious — without itself making remote writes.

This change also renames the capability `shim-init` → `init`: the user-facing command is `init`, and "shim" has been dropped from all copy.

## What Changes

- **Capability rename**: `shim-init` → `init`. The canonical spec moves to `openspec/specs/init/`.
- **Label readiness check** in `init`: when `gh` is on PATH and a GitHub remote resolves (the same gate the secret probe uses), `init` runs a **read-only** `gh label list` and reports which of the three contract labels (`openspec:go`, `openspec:spec`, `openspec:impl`) exist.
- **Print, don't execute**: for any missing label, `init` prints the exact `gh label create` command (with canonical color + description) in its next-steps output. `init` performs **no** remote writes — it stays a local-files-only command.
- **Reserved flag**: `--github-labels` is documented as the future switch that will run the creates instead of printing them. Not implemented in this change.

## Capabilities

### Modified Capabilities

- `init` (renamed from `shim-init`): add the label-readiness requirement. The existing requirements (binary surface, workflow write, README patch, secret probe, OpenSpec hard gate, exit codes) are unchanged in behaviour; they move with the rename.

## Impact

- **Affected code**: `src/init/detect.ts` (new read-only `probeLabels`), `src/init/index.ts` (label status in the report + `gh label create` commands in next-steps).
- **Affected specs**: `shim-init` → `init` rename; one ADDED requirement.
- **Remote writes**: none. Read-only `gh label list`; everything else is printed.
- **Deps**: none.
