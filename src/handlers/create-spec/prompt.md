You are running inside a fresh checkout of repository `{{repo}}`
on the default branch. The surrounding harness has already created
the branch for this change. After you finish, the harness will
push your commit and open the spec PR for you.

A user has opened issue **#{{issueNumber}}** with the title:

> {{issueTitle}}

**Scope discipline — read this first.** The repo may contain other
directories under `openspec/changes/` that are unrelated to this
issue (work-in-progress for other issues, archived changes you can
ignore). Your work for this run MUST live in exactly one new
directory, and that directory MUST be named:

```
openspec/changes/{{changeName}}/
```

Do NOT edit, archive, or read other change directories. Do NOT
pick a different name — the harness reads from
`openspec/changes/{{changeName}}/` after you finish, and anything
else will be ignored.

Your job:

1. **Read the issue context first.** Use the tools available to
   you to fetch the full issue body and every comment on the
   issue. Reason about the whole discussion, not just the title.
2. **Use the `openspec-new-change` skill** to scaffold an OpenSpec
   change at exactly `openspec/changes/{{changeName}}/`. When the
   skill asks for a name, use `{{changeName}}`. The skill knows
   the rest of the conventions; follow it.
3. **Fill the artefacts** the skill creates: `proposal.md`,
   `design.md`, `specs/<capability>/spec.md` (delta), `tasks.md`.
   Keep the scope to one change unless the issue genuinely spans
   capabilities.
4. **Validate** with `openspec validate {{changeName}}` before you
   finish. Iterate if it fails.
5. **Commit when done.** Stage your changes with `git add` and
   make a commit whose message describes what you did. Follow the
   conventions in the repo's `CLAUDE.md` (if any). The harness
   will push your commit — don't push yourself.
