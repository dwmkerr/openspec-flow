## 1. Lock in the capability spec

- [ ] 1.1 Confirm `shim-distribution` is the right capability name (no
      conflicts with existing specs under `openspec/specs/`)
- [ ] 1.2 Walk the five strategies in `design.md` against the spec's
      enumeration requirement; ensure every named strategy has a matching
      requirement scenario
- [ ] 1.3 Verify each requirement in `specs/shim-distribution/spec.md` has
      at least one `#### Scenario:` block with WHEN/THEN format
- [ ] 1.4 Run `openspec validate explore-shim-architecture` and fix any
      structural issues

## 2. Cross-link with existing docs

- [ ] 2.1 Add a "Shim model" section to `docs/architecture.md` linking
      to the new capability spec
- [ ] 2.2 Update `docs/architecture.md` "Open decisions" section to
      reference this RFC for the shim-vs-Probot question
- [ ] 2.3 Confirm `README.md` install instructions still match the
      current Mode A snippet (no contradiction with the new spec)
- [ ] 2.4 Confirm `public/index.html` mental model is unchanged (this
      RFC adds nothing user-visible yet)

## 3. Seed the follow-on selection change

- [ ] 3.1 Open a stub OpenSpec change `select-shim-strategy` whose
      proposal cites this change and whose first task is "fill the
      rubric in `specs/shim-distribution/spec.md`"
- [ ] 3.2 In `ideas.md`, add a one-line entry pointing at the
      `select-shim-strategy` follow-on so it's visible in the backlog
- [ ] 3.3 Reference both this change and the follow-on in the impl PR
      body under "What this unlocks"

## 4. Validate and archive

- [ ] 4.1 Run `openspec validate explore-shim-architecture --strict` and
      resolve any warnings
- [ ] 4.2 Confirm no edits were made by hand to
      `openspec/specs/shim-distribution/spec.md` (it does not exist yet;
      the delta will create it on archive)
- [ ] 4.3 Archive the change with `openspec archive
      explore-shim-architecture --yes` in the impl PR per CLAUDE.md
