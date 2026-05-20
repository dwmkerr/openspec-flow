The OpenSpec change `{{changeName}}` has its spec scaffolded.
Implement it now.

1. Use the openspec-apply-change skill with change `{{changeName}}`
   to work through the tasks. The skill reads context and walks
   the task list itself.

2. When all tasks are ticked, use the openspec-verify-change skill
   with change `{{changeName}}`. If it reports CRITICAL issues,
   loop back to apply. Continue until verify is clean.

3. Run `openspec archive {{changeName}} --yes` in the shell. This
   moves the change to `openspec/changes/archive/` and merges the
   spec deltas into `openspec/specs/`. The `--yes` flag is the
   documented unattended-archive escape hatch.

The surrounding harness will branch, commit, push, and open the
impl PR. Make local changes only.
