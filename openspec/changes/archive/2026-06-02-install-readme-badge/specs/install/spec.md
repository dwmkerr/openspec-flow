## ADDED Requirements

### Requirement: Badge block is its own marker-gated region under the H1

When `install` writes the managed README and the target repo's GitHub remote resolves (cwd's `origin` URL parses as `github.com/<owner>/<name>`), it SHALL inject a GitHub Actions status badge for the openspec-flow workflow inside its own marker pair:

```
<!-- openspec-flow badge-start -->
[![openspec-flow](https://github.com/<owner>/<name>/actions/workflows/openspec-flow.yml/badge.svg)](https://github.com/<owner>/<name>/actions/workflows/openspec-flow.yml)
<!-- openspec-flow badge-end -->
```

The badge block SHALL sit immediately under the README's first `# ` H1 line so it appears with title-area badges, separate from the main managed block. It SHALL follow the same three-state model as the main block:

- **No badge markers** — insert under the H1 (or prepend if no H1 exists).
- **Markers present** — leave the block alone; the user owns it.
- **`--force`** — overwrite the content between the markers.

When the GitHub remote cannot be resolved (no `origin`, non-GitHub URL, or git absent), the badge SHALL be omitted entirely. `uninstall` SHALL strip the badge marker pair in addition to the main managed block.

#### Scenario: Badge sits under the H1 with its own markers

- **WHEN** `install --yes` runs in a repo whose origin resolves and whose README has `# My Project` as the first heading
- **THEN** the line immediately after `# My Project` (separated by a blank line) is `<!-- openspec-flow badge-start -->`
- **AND** the badge image-link follows, then `<!-- openspec-flow badge-end -->`

#### Scenario: Re-run leaves the badge block alone

- **WHEN** `install --yes` runs again in a repo that already has the badge markers
- **THEN** the badge block is not modified

#### Scenario: Force overwrites the badge between markers

- **WHEN** `install --yes --force` runs and the badge markers exist
- **THEN** the content between the badge markers is replaced with the current rendered badge

#### Scenario: No GitHub remote → no badge

- **WHEN** `install --yes` runs with no resolvable GitHub `origin`
- **THEN** the README contains no badge marker pair

#### Scenario: uninstall strips both managed regions

- **WHEN** `uninstall --yes` runs against a README with both marker pairs
- **THEN** both the badge block and the main managed block are removed
- **AND** content outside both regions is preserved
