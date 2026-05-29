## 1. Commander

- [x] 1.1 Add `commander@^14` dependency
- [x] 1.2 Rewrite `src/cli.ts` as a commander program (install, uninstall, dispatch, handle+children)
- [x] 1.3 `--version` from package.json; `exitOverride` so `runCli` returns the exit code
- [x] 1.4 Required options on handle subcommands; unknown command / missing option exit non-zero

## 2. Verification

- [x] 2.1 `npm run typecheck` + `npm test` green
- [x] 2.2 Help smoke: top-level lists commands; `install --help` shows flags; `handle --help` lists children
- [x] 2.3 Exit codes: help 0, unknown command 1, missing required option 1
- [x] 2.4 `openspec validate cli-commander` clean

## 3. Archive

- [x] 3.1 `openspec archive cli-commander --yes`
