# OpenSpec Concepts

## Philosophy

OpenSpec is built on four principles stated in the README:

```
fluid not rigid         — no phase gates, work on what makes sense
iterative not waterfall — learn as you build, refine as you go
easy not complex        — lightweight setup, minimal ceremony
brownfield-first        — works with existing codebases
```

The core insight: AI coding without specs means vague prompts and unpredictable results. OpenSpec adds a lightweight spec layer so humans and AI agree on what to build before any code is written, without heavyweight process.

## The Two-Directory Model

All OpenSpec state lives under `openspec/` at the project root:

```
openspec/
├── specs/          # Source of truth — how the system currently behaves
│   └── <domain>/
│       └── spec.md
├── changes/        # Proposed modifications — one folder per change
│   └── <name>/
│       ├── proposal.md
│       ├── design.md
│       ├── tasks.md
│       ├── .openspec.yaml    # change metadata (schema, created date)
│       └── specs/            # delta specs for this change
│           └── <capability>/
│               └── spec.md
└── config.yaml     # project configuration (optional)
```

`specs/` is the canonical record of what the system does. `changes/` holds in-progress work. When a change is archived, its delta specs are merged into `specs/` and the change folder moves to `changes/archive/YYYY-MM-DD-<name>/`.

## Changes

A **change** is a proposed modification packaged as a self-contained folder. Each change has:

- **Artifacts** — documents that capture intent, design, and tasks
- **Delta specs** — specifications for what is being added, modified, or removed from the main specs
- **Metadata** — `.openspec.yaml` storing the schema name and creation date

Changes are parallel-safe. You can work on multiple changes simultaneously without conflicts, because each change has its own folder.

## Artifacts

Artifacts are the documents within a change. The default `spec-driven` schema uses four:

| Artifact | File | Purpose |
|----------|------|---------|
| proposal | `proposal.md` | The "why" and "what" — intent, scope, capabilities affected |
| specs | `specs/<capability>/spec.md` | Delta specs defining what changes behaviorally |
| design | `design.md` | The "how" — technical decisions and architecture |
| tasks | `tasks.md` | Implementation checklist with checkboxes |

Artifacts form a dependency graph: proposal is created first, specs and design both require proposal, tasks require both specs and design. This DAG is defined in the schema (see [workflows.md](workflows.md)).

### proposal.md

Captures intent, scope, and which capabilities are affected. The Capabilities section is critical — it establishes which spec files will be created or modified. Each capability listed becomes a `specs/<capability>/spec.md` delta.

Template (from `schemas/spec-driven/templates/proposal.md`):
```markdown
## Why
<!-- Explain the motivation for this change. -->

## What Changes
<!-- Specific new capabilities, modifications, or removals. -->

## Capabilities

### New Capabilities
- `<name>`: <brief description>

### Modified Capabilities
- `<existing-name>`: <what requirement is changing>

## Impact
<!-- Affected code, APIs, dependencies, systems -->
```

### specs/ (delta specs)

Each spec file in a change's `specs/` directory is a **delta spec** — it describes only what is changing relative to the main spec. See [Delta Specs](#delta-specs) below.

### design.md

Documents technical decisions. Created for cross-cutting changes, new architectural patterns, new external dependencies, significant data model changes, security/performance concerns, or anywhere ambiguity could cause expensive rework.

Sections: Context, Goals/Non-Goals, Decisions (with rationale and alternatives), Risks/Trade-offs, Migration Plan, Open Questions.

### tasks.md

The implementation checklist. Tasks use checkbox format (`- [ ]`) which the apply phase tracks. Groups of tasks are numbered hierarchically (1.1, 1.2, etc.).

Template:
```markdown
## 1. <Task Group Name>

- [ ] 1.1 <Task description>
- [ ] 1.2 <Task description>

## 2. <Task Group Name>

- [ ] 2.1 <Task description>
```

## Delta Specs

Delta specs are the key mechanism for brownfield development. Instead of rewriting an entire spec, a delta spec describes only what is changing.

### Format

Delta specs use section headers to indicate the operation type:

```markdown
## ADDED Requirements

### Requirement: Two-Factor Authentication
The system MUST support TOTP-based two-factor authentication.

#### Scenario: 2FA login
- **WHEN** the user submits valid credentials with 2FA enabled
- **THEN** an OTP challenge is presented

## MODIFIED Requirements

### Requirement: Session Expiration
The system MUST expire sessions after 15 minutes of inactivity.
(Previously: 30 minutes)

#### Scenario: Idle timeout
- **WHEN** 15 minutes pass without activity
- **THEN** the session is invalidated

## REMOVED Requirements

### Requirement: Remember Me
(Deprecated in favor of 2FA.)

## RENAMED Requirements

- FROM: `### Requirement: Old Name`
- TO: `### Requirement: New Name`
```

### Delta Operations on Archive

| Section | What happens when archived |
|---------|---------------------------|
| `## ADDED Requirements` | Appended to the main spec |
| `## MODIFIED Requirements` | Replaces the existing requirement block in main spec |
| `## REMOVED Requirements` | Deletes the requirement from main spec |
| `## RENAMED Requirements` | Renames the requirement in main spec |

**MODIFIED requirements must include the full updated content** — not just the changed parts. The archive operation replaces the entire requirement block.

**Important formatting rule**: Scenario headers must use exactly four hashtags (`####`). Three hashtags or bullets fail silently.

### Main Spec Format

Main specs in `openspec/specs/` use the full requirement/scenario format:

```markdown
# Auth Specification

## Purpose
Authentication and session management.

## Requirements

### Requirement: User Authentication
The system SHALL issue a JWT token upon successful login.

#### Scenario: Valid credentials
- GIVEN a user with valid credentials
- WHEN the user submits the login form
- THEN a JWT token is returned
- AND the user is redirected to dashboard
```

RFC 2119 keywords (SHALL/MUST/SHOULD/MAY) indicate requirement strength.

## Schemas

A **schema** defines the artifact types, their dependencies, and the templates used to create them. Schemas are stored as YAML + Markdown in:

- `openspec/schemas/<name>/` — project-local (version-controlled)
- `~/.local/share/openspec/schemas/<name>/` — user-level (shared across projects)
- Package built-ins (e.g., `spec-driven`)

Schema resolution order (highest priority first):
1. CLI flag `--schema <name>`
2. Change metadata (`.openspec.yaml` in the change folder)
3. Project config (`openspec/config.yaml`)
4. Package default (`spec-driven`)

The only built-in schema is `spec-driven`. See [workflows.md](workflows.md) for its full definition.

## Workflow Profiles

Global config controls which commands get installed:

- **`core` profile** (default): installs `propose`, `explore`, `apply`, `sync`, `archive`
- **`custom` profile**: installs whatever workflows you select with `openspec config profile`

All available workflows: `propose`, `explore`, `new`, `continue`, `apply`, `ff`, `sync`, `archive`, `bulk-archive`, `verify`, `onboard`.

Delivery mode controls what gets written:
- `both` (default): installs both skills (`.claude/skills/`) and commands (`.claude/commands/opsx/`)
- `skills`: only skills
- `commands`: only commands

## The Lifecycle

The complete lifecycle of a change:

1. **Explore** (optional) — `/opsx:explore` to think through the problem before committing
2. **New** — create the change folder with `openspec new change <name>` (or via `/opsx:new`, `/opsx:propose`, `/opsx:ff`)
3. **Artifacts** — create proposal → specs → design → tasks in dependency order
4. **Apply** — implement tasks, checking them off as code is written
5. **Verify** (optional) — `/opsx:verify` checks completeness, correctness, and coherence
6. **Sync** (optional) — merge delta specs into main specs without archiving
7. **Archive** — move change to `changes/archive/YYYY-MM-DD-<name>/`, merging delta specs into main

After archive, `openspec/specs/` reflects the new behavior, ready for the next change.

## Archive Behavior

`openspec archive <name>` (CLI command, not the skill):

1. Validates the change (skippable with `--no-validate`)
2. Merges delta specs into `openspec/specs/`
3. Moves `openspec/changes/<name>/` to `openspec/changes/archive/YYYY-MM-DD-<name>/`

The skill `openspec-archive-change` does the same process but agent-driven: it calls `openspec status --json`, checks task/artifact completion, offers to sync delta specs first (via `openspec-sync-specs`), then performs the `mv`.

`--skip-specs` is useful for infrastructure, tooling, or doc-only changes that have no behavioral spec changes.

## Coordination Workspaces (Beta)

For work that spans multiple repos or folders, OpenSpec has an experimental workspace concept. A workspace is a coordination home with stable link names pointing to repo paths.

```
workspace-folder/
├── changes/
└── .openspec-workspace/
    ├── workspace.yaml   # shared — stable link names, workspace name
    └── local.yaml       # machine-local — actual paths
```

**Status**: Under active development. Do not build production automation on top of workspace commands.

Commands: `workspace setup`, `workspace list`, `workspace link`, `workspace relink`, `workspace doctor`, `workspace open`.

## Glossary

| Term | Definition |
|------|------------|
| Artifact | A document within a change (proposal, design, tasks, or delta specs) |
| Archive | The process of completing a change and merging its deltas into main specs |
| Change | A proposed modification, packaged as a folder with artifacts and delta specs |
| Delta spec | A spec file that describes changes (ADDED/MODIFIED/REMOVED/RENAMED) relative to current specs |
| Domain | A logical grouping for specs (e.g., `auth/`, `payments/`) |
| Requirement | A specific behavior the system must have, expressed with RFC 2119 keywords |
| Scenario | A concrete testable example of a requirement, in GIVEN/WHEN/THEN/AND format |
| Schema | A YAML definition of artifact types, their dependencies, and their templates |
| Spec | A specification file describing system behavior as requirements and scenarios |
| Source of truth | The `openspec/specs/` directory — the current agreed-upon behavioral specification |
