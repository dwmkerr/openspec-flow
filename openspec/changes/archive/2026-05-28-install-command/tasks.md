## 1. Rename

- [x] 1.1 `git mv src/init src/install`; `git mv openspec/specs/init openspec/specs/install`
- [x] 1.2 Rename `runInit`/`InitOptions` → `runInstall`/`InstallOptions`; update copy strings
- [x] 1.3 README markers `init-start/end` → `install-start/end` in `templates.ts`
- [x] 1.4 `src/cli.ts`: command `init` → `install`; update usage

## 2. uninstall

- [x] 2.1 `src/install/uninstall.ts` — remove workflow (template match / `--force`), strip README block, print `gh label delete` commands
- [x] 2.2 Idempotent: nothing present → "nothing to uninstall", exit 0
- [x] 2.3 Non-TTY without `--yes` → exit 2
- [x] 2.4 Wire `uninstall` command in `src/cli.ts`

## 3. Verification

- [x] 3.1 `npm run typecheck` + `npm test` green
- [x] 3.2 Round-trip smoke: install → files written; uninstall → files removed, README restored byte-identical
- [x] 3.3 `openspec validate install-command` clean

## 4. Archive

- [x] 4.1 `openspec archive install-command --yes`
