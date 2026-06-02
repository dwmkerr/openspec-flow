## ADDED Requirements

### Requirement: One upserted lifecycle comment per issue

openspec-flow SHALL maintain a single lifecycle comment on the originating issue, identified by the HTML marker `<!-- openspec-flow:lifecycle -->`. At each lifecycle transition the responsible handler SHALL upsert (create if absent, otherwise edit) that comment rather than posting a new one. The comment SHALL render a checklist whose items are ticked up to the current phase:

- spec PR opened — #`<spec-pr>`
- spec PR merged
- impl PR opened — #`<impl-pr>`
- implemented & merged — #`<impl-pr>` (issue closed)

Upserting SHALL be best-effort: a failure SHALL be logged as a warning and SHALL NOT block the handler's substantive work.

#### Scenario: First stamp creates the comment

- **WHEN** `create-spec` opens a spec PR for an issue with no existing lifecycle comment
- **THEN** a comment containing `<!-- openspec-flow:lifecycle -->` is created on the issue
- **AND** its checklist ticks "spec PR opened — #`<spec-pr>`"

#### Scenario: Later stamps edit the same comment

- **WHEN** a later transition stamps the lifecycle for an issue that already has the marked comment
- **THEN** the existing comment is edited in place
- **AND** no additional lifecycle comment is created

#### Scenario: Upsert failure does not block work

- **WHEN** the lifecycle upsert call fails
- **THEN** a warning is logged
- **AND** the handler completes its substantive work (PR open, push) normally

### Requirement: create-spec seeds the lifecycle

When `create-spec` opens a spec PR, it SHALL upsert the issue lifecycle comment at the `spec PR opened` phase, recording the spec PR number.

#### Scenario: Spec opened phase

- **WHEN** `create-spec` finishes opening spec PR #N for issue #I
- **THEN** issue #I's lifecycle comment ticks "spec PR opened — #N"
- **AND** the remaining items are unticked

### Requirement: create-impl advances the lifecycle on the issue

When `create-impl` opens an impl PR, it SHALL resolve the originating issue from the spec-PR metadata block and upsert that issue's lifecycle comment at the `impl PR opened` phase, recording the impl PR number. This stamp SHALL tick "spec PR merged" (implied by the create-impl trigger) and "impl PR opened".

#### Scenario: Impl opened phase

- **WHEN** `create-impl` finishes opening impl PR #M for the spec PR linked to issue #I
- **THEN** issue #I's lifecycle comment ticks "spec PR opened", "spec PR merged", and "impl PR opened — #M"
- **AND** "implemented & merged" remains unticked

### Requirement: finalize-impl stamps the terminal line

A `finalize-impl` handler SHALL run when an `openspec:impl` PR is merged. It SHALL resolve the originating issue from the impl-PR metadata block and upsert that issue's lifecycle comment at the `implemented & merged` phase, ticking all items. The handler SHALL tolerate the issue already being closed (GitHub auto-closes it via `Closes #N`).

#### Scenario: Terminal phase on a closed issue

- **WHEN** an impl PR #M that closes issue #I is merged
- **THEN** issue #I's lifecycle comment ticks all items including "implemented & merged — #M (issue closed)"
- **AND** the upsert succeeds even though the issue is closed

#### Scenario: finalize-impl opens no PR and runs no agent

- **WHEN** `finalize-impl` runs
- **THEN** it performs only the lifecycle upsert
- **AND** it does not clone the repo, run the agent, or open a PR
