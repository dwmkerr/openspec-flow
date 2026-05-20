The OpenSpec change `{{changeName}}` has its spec ready. You are
running inside a fresh checkout of `{{repo}}` and the harness has
already created the impl branch. After you finish, the harness will
push your commit and open the impl PR.

Implement the change now.

1. Use the `openspec-apply-change` skill with change
   `{{changeName}}` to work through the tasks. The skill reads
   context and walks the task list itself.

2. When all tasks are ticked, use the `openspec-verify-change`
   skill with change `{{changeName}}`. If it reports CRITICAL
   issues, loop back to apply. Continue until verify is clean.

3. Run `openspec archive {{changeName}} --yes` in the shell to
   move the change to `openspec/changes/archive/` and merge spec
   deltas into `openspec/specs/`. The `--yes` flag is the
   documented unattended-archive escape hatch.

4. **Commit when done.** Stage your changes with `git add` and
   make a commit whose message describes what you implemented.
   Follow the conventions in the repo's `CLAUDE.md` (if any).
   The harness will push your commit — don't push yourself.
