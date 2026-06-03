## ADDED Requirements

### Requirement: Badge H1 anchor ignores fenced code blocks

`install` SHALL anchor the badge block under the first markdown `# ` heading that sits **outside** any fenced code block (`` ``` `` toggles fence state line by line). `# ` lines inside fenced blocks (e.g. bash comments) SHALL NOT be treated as the title. When no markdown H1 exists outside fences, the badge SHALL be prepended at the top of the README.

#### Scenario: Markdown H1 above a fenced block anchors the badge

- **WHEN** `install --yes` runs on a README where line 1 is `# My Tool` and a fenced bash block later contains `# Setup`
- **THEN** the badge marker pair appears directly after `# My Tool`
- **AND** no badge content is inserted inside the fenced block

#### Scenario: HTML-only title falls back to prepend

- **WHEN** `install --yes` runs on a README with no markdown `# ` lines outside fences (e.g. `<p align="center">…</p>` title)
- **THEN** the badge marker pair appears at the top of the file
- **AND** no `# ` lines inside fenced blocks were used as the anchor
