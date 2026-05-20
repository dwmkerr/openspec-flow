## MODIFIED Requirements

### Requirement: Handler force-pushes the spec branch with an explicit lease

The handler SHALL commit with a headline of the form
`chore: iterate spec for #<issue> — <short-description>` and SHALL
force-push the spec branch to `origin` using
`--force-with-lease=<branch>:<remote-sha>` (the lease SHA obtained
via `ls-remote`). The `<short-description>` is the agent-authored
iteration summary (see requirement "Agent writes a one-line
iteration summary to a known workdir file") after trim,
single-line collapse, and truncation to 60 characters with an
appended `…` if oversized. If the summary file is missing, empty,
or whitespace-only, the handler SHALL fall back to the headline
`chore: iterate spec for #<issue>` (no em-dash, no description).
The handler SHALL NOT create a new branch.

#### Scenario: Push uses explicit lease
- **WHEN** the handler pushes the iterated spec branch
- **THEN** the push command uses the explicit `--force-with-lease=<branch>:<sha>` form so concurrent writers are detected

#### Scenario: Headline includes agent-authored short description
- **GIVEN** the agent wrote `clarify multi-line handling` to `.openspec-flow/iterate-summary.txt`
- **WHEN** the handler commits the iteration on issue #26
- **THEN** the commit headline is exactly `chore: iterate spec for #26 — clarify multi-line handling`

#### Scenario: Headline falls back when summary file is missing
- **GIVEN** the agent did not write `.openspec-flow/iterate-summary.txt`
- **WHEN** the handler commits the iteration on issue #26
- **THEN** the commit headline is exactly `chore: iterate spec for #26`

#### Scenario: Headline falls back when summary file is whitespace-only
- **GIVEN** `.openspec-flow/iterate-summary.txt` contains only spaces and newlines
- **WHEN** the handler commits the iteration on issue #26
- **THEN** the commit headline is exactly `chore: iterate spec for #26`

#### Scenario: Oversized summary is truncated with ellipsis
- **GIVEN** the agent wrote a 200-character summary
- **WHEN** the handler builds the headline
- **THEN** the description portion after the em dash is at most 60 characters and ends with `…`

#### Scenario: Multi-line summary collapses to the first non-empty line
- **GIVEN** the summary file contains three non-empty lines
- **WHEN** the handler builds the headline
- **THEN** only the first non-empty line is used and embedded newlines and tabs are removed

## ADDED Requirements

### Requirement: Agent writes a one-line iteration summary to a known workdir file

The agent's prompt SHALL instruct the agent, after rewriting the
spec artefacts, to write a single-line summary of what the
iteration changed to `.openspec-flow/iterate-summary.txt` inside
the workdir. The summary SHALL be lower-case, ≤ 60 characters,
with no trailing punctuation, and describe the substance of the
iteration (not the fact that an iteration occurred). The handler
SHALL ensure `.openspec-flow/` is gitignored in the workdir
before the agent runs so the summary file is not staged into the
commit.

#### Scenario: Prompt instructs the agent to write the summary file
- **WHEN** the handler renders the prompt
- **THEN** the rendered prompt names the file path `.openspec-flow/iterate-summary.txt`, the 60-character limit, the lower-case style, and that the summary describes what changed

#### Scenario: Summary file is not staged into the commit
- **GIVEN** the agent wrote `.openspec-flow/iterate-summary.txt`
- **WHEN** the handler runs `git add -A` and commits
- **THEN** the resulting commit does not include `.openspec-flow/iterate-summary.txt`

#### Scenario: Missing summary file does not abort the iteration
- **GIVEN** the agent rewrote the spec but did not write the summary file
- **WHEN** the handler runs verify, add, commit, push
- **THEN** the iteration completes successfully with the fallback headline and no failure comment is posted
