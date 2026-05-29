## Why

The CLI used a hand-rolled arg parser with a single flat usage string that dumped every command and flag at once — hard to scan, no per-command help, no validation of required options. Adopting `commander` (the stack already chosen for the project's TUI work) gives a proper command tree: the top level lists commands, each command carries its own `--help`, and required options + unknown commands are validated for free.

## What Changes

- Add `commander` as a runtime dependency.
- Rewrite `src/cli.ts` as a commander program:
  - top-level `openspec-flow --help` lists `install`, `uninstall`, `dispatch`, `handle`
  - `handle` is a parent command with `create-spec` / `create-impl` / `iterate-spec` / `iterate-impl` children
  - each command has its own `--help`; `--version` prints the package version
  - unknown command / missing required option exit non-zero with a clear message
- No change to command names, flags, or behaviour — only help structure and validation.

## Capabilities

### Modified Capabilities

- `install`: extend the binary-surface requirement to specify hierarchical help (top level lists commands, each command has its own help), `--version`, and non-zero exit on unknown command or missing required option.

## Impact

- **Affected code**: `src/cli.ts` (rewritten), `package.json` (commander dep).
- **Behaviour**: unchanged command surface; better help + validation.
- **Deps**: +`commander@^14`.
