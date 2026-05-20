## 1. Score the rubric

- [ ] 1.1 Fill the rubric in `openspec/specs/shim-distribution/spec.md`
      (one row per strategy S1–S5, each cell with evidence)
- [ ] 1.2 Identify the two or three axes that matter most and document
      the weighting reason

## 2. Pick a strategy

- [ ] 2.1 Pick a single winning strategy. Document the reasons in
      `design.md`.
- [ ] 2.2 Add MODIFIED requirements to the `shim-distribution` spec
      delta that bind install/upgrade/remove to the chosen strategy
- [ ] 2.3 Update `docs/architecture.md` "Shim model" section to call
      out the chosen strategy

## 3. Hand off

- [ ] 3.1 Name the next implementation change (likely one of
      `add-shim-installer-app`, `add-openspec-flow-init-cli`,
      `formalise-thin-shim-workflow`)
- [ ] 3.2 Add a one-line entry in `ideas.md` for that follow-on
- [ ] 3.3 Run `openspec validate select-shim-strategy --strict` and
      archive
