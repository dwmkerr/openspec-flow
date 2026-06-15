# issue-lifecycle-comment Specification Delta

## MODIFIED Requirements

### Requirement: Lifecycle sticky footer surfaces project sponsor link and hosting cost

The lifecycle sticky comment's footer SHALL render as a right-aligned `<sub>` block containing three pipe-separated links:

1. `openspec-flow` → `https://github.com/dwmkerr/openspec-flow`
2. `docs` → `https://github.com/dwmkerr/openspec-flow#readme`
3. `sponsoring` → `https://github.com/sponsors/dwmkerr`

The third link SHALL be accompanied by a single-line natural-language nudge of the form "costs a little each month to host - please consider <sponsoring>". The footer SHALL remain a single line, SHALL remain right-aligned, and SHALL remain inside `<sub>` so visual weight is below the headline and status table.

The footer SHALL NOT use emoji, SHALL NOT contain donation tiers, and SHALL NOT exceed one line in rendered HTML.

The footer text SHALL appear on every variant of the sticky comment (issue audience and PR audience) and SHALL NOT vary by App install state, run state, or failure state.

#### Scenario: Default sticky comment includes the sponsor link

- **GIVEN** a sticky comment is rendered for any state (creating, pr-open, pr-merged, failed)
- **WHEN** the comment body is inspected
- **THEN** the body SHALL contain the substring `https://github.com/sponsors/dwmkerr`
- **AND** the body SHALL contain the substring `sponsoring</a>`
- **AND** the body SHALL contain the phrase "costs a little each month to host"

#### Scenario: Footer remains right-aligned and inside <sub>

- **WHEN** the sticky comment is rendered
- **THEN** the footer SHALL appear inside `<div align="right"><sub>…</sub></div>`
- **AND** all three links SHALL appear within that block

#### Scenario: Footer is identical on issue and PR audiences

- **GIVEN** the same `LifecycleStickyState`
- **WHEN** rendered with `audience: "issue"` and again with `audience: "pr"`
- **THEN** the footer block SHALL be byte-identical between the two renderings
