## Why

The scaffold command was `init`, which collides conceptually with `openspec init` and has no natural inverse. Testing the flow against real repos needs a teardown step (install → test → uninstall → repeat). Renaming to `install` + adding a symmetric `uninstall` gives a clean pair and the cleanup path.

## What Changes

- **Rename** the command `init` → `install` (and the capability `init` → `install`, the module `src/init` → `src/install`).
- **New `uninstall` command**: removes `.github/workflows/openspec-flow.yml` (matches template → remove; diverged → warn, `--force` removes), strips the managed README block between markers leaving surrounding content byte-identical, and prints `gh label delete` commands for the contract labels. No remote writes (mirrors install's print-don't-execute).
- **README markers** renamed `<!-- openspec-flow init-start/end -->` → `<!-- openspec-flow install-start/end -->` for consistency with the command.
- **Reserved flag** `--github-labels` documented on both commands as the future switch that runs the label create/delete commands.

## Capabilities

### Modified Capabilities

- `install` (renamed from `init`): the binary-surface requirement changes the verb to `install` and adds `uninstall`; a new requirement specifies the `uninstall` behaviour (workflow removal, README block strip, label-delete command printing, idempotency).

## Impact

- **Affected code**: `src/install/*` (renamed from `src/init`), new `src/install/uninstall.ts`, `src/cli.ts` (command rename + `uninstall` wiring + usage), README marker constants in `src/install/templates.ts`.
- **Affected specs**: capability `init` → `install` rename; one MODIFIED + one ADDED requirement.
- **Remote writes**: none. `uninstall` prints `gh label delete` commands; deletion is the user's call.
- **Compatibility**: pre-release, no published installs. README marker rename only affects repos scaffolded by the old `init` (re-run `install` to refresh).
