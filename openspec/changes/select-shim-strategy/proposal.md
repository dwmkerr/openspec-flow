## Why

`explore-shim-architecture` (the RFC) added the `shim-distribution` capability
and enumerated five candidate strategies (S1 thin reusable-workflow shim, S2
App-as-installer, S3 npm scaffolder, S4 fat workflow shim, S5 manifest-only).
It deliberately did not pick a winner — the rubric in
`openspec/specs/shim-distribution/spec.md` is intentionally unfilled.

This change is the follow-on. It scores each candidate strategy against the
published rubric, picks a single winner with explicit reasons, and amends the
`shim-distribution` spec with the strategy-specific requirements that result.

## What Changes

- Score S1–S5 against the rubric (install friction, run latency, operating
  cost, security surface, upgrade UX, transparency) with evidence per cell.
- Pick one strategy. Document the reasons. Note which axes were weighted.
- Add MODIFIED requirements to `shim-distribution` that bind the chosen
  strategy: install/upgrade/remove flow, exact secrets needed, exact App
  permissions required.
- Identify the next implementation change (likely one of
  `add-shim-installer-app`, `add-openspec-flow-init-cli`, or
  `formalise-thin-shim-workflow`).

This change is still spec-only. The follow-on implementation change ships
code.

## Capabilities

### Modified Capabilities

- `shim-distribution`: scored rubric, chosen strategy, strategy-specific
  install/upgrade/remove requirements.

### New Capabilities

<!-- None. This change refines an existing capability. -->

## Impact

- `openspec/specs/shim-distribution/spec.md` gains a filled rubric and
  strategy-specific requirements on archive.
- `docs/architecture.md` "Shim model" section is updated to point at the
  chosen strategy.
- No code changes; no CI changes; no new dependencies.

## References

- Parent RFC: `openspec/changes/archive/<timestamp>-explore-shim-architecture/`
  once archived.
- Capability spec: `openspec/specs/shim-distribution/spec.md`.
