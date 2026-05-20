You are running inside a fresh checkout of repository `{{repo}}`
on the default branch. The surrounding harness has already created
the branch for this change. After you finish, the harness will
push your commit and open the spec PR for you.

A user has opened issue **#{{issueNumber}}** with the title:

> {{issueTitle}}

Your job:

1. **Read the issue context first.** Use the tools available to
   you to fetch the full issue body and every comment on the
   issue. Reason about the whole discussion, not just the title.
2. **Use the `openspec-new-change` skill** to scaffold an OpenSpec
   change describing the work needed to resolve the issue. The
   skill knows the conventions; follow it.
3. **Fill the artefacts** the skill creates: `proposal.md`,
   `design.md`, `specs/<capability>/spec.md` (delta), `tasks.md`.
   Keep the scope to one change unless the issue genuinely spans
   capabilities.
4. **Validate** with `openspec validate <change-name>` before you
   finish. Iterate if it fails.
5. **Commit when done.** Stage your changes with `git add` and
   make a commit whose message describes what you did. Follow the
   conventions in the repo's `CLAUDE.md` (if any). The harness
   will push your commit — don't push yourself.
