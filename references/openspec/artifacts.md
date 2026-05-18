# Artifacts Reference

This document covers the file layout, artifact formats, and delta spec format. Examples are drawn from the OpenSpec source templates.

## Project File Layout

After `openspec init` and at least one change:

```
openspec/
├── config.yaml                          # project configuration
├── specs/                               # source of truth
│   └── <capability>/
│       └── spec.md
└── changes/
    ├── <change-name>/                   # active change
    │   ├── .openspec.yaml              # change metadata
    │   ├── proposal.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── specs/
    │       └── <capability>/
    │           └── spec.md             # delta spec
    └── archive/
        └── YYYY-MM-DD-<change-name>/   # archived change (full contents preserved)
            ├── .openspec.yaml
            ├── proposal.md
            ├── design.md
            ├── tasks.md
            └── specs/
                └── <capability>/
                    └── spec.md
```

## config.yaml

Located at `openspec/config.yaml`. Optional but recommended.

```yaml
schema: spec-driven

# Project context injected into all artifact instructions.
# AI sees this as constraints when writing artifacts, but must not copy it into output files.
context: |
  Tech stack: TypeScript, React, Node.js
  API style: RESTful, JSON responses
  Testing: Vitest for unit tests, Playwright for e2e
  We use conventional commits

# Per-artifact rules (optional). Keys must be valid artifact IDs for the schema.
rules:
  proposal:
    - Include rollback plan
    - Identify affected teams
  specs:
    - Use Given/When/Then format for scenarios
  design:
    - Include sequence diagrams for complex flows
  tasks:
    - Break tasks into chunks of max 2 hours
```

Context is injected into ALL artifact instructions. Rules are injected only for the matching artifact ID. Both are wrapped in XML tags (`<context>`, `<rules>`) in the instructions output. Context has a 50KB size limit. Unknown artifact IDs in rules generate warnings.

## .openspec.yaml (Change Metadata)

Created by `openspec new change`. Stores the schema and creation date.

```yaml
schema: spec-driven
# (created date also stored)
```

This file is preserved when the change is archived (moves with the folder).

## proposal.md

The "why" and "what". Template from `schemas/spec-driven/templates/proposal.md`:

```markdown
## Why

<!-- Explain the motivation for this change. What problem does this solve? Why now? -->

## What Changes

<!-- Describe what will change. Be specific about new capabilities, modifications, or removals. -->

## Capabilities

### New Capabilities
<!-- Each becomes specs/<name>/spec.md -->
- `<name>`: <brief description of what this capability covers>

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing. -->
- `<existing-name>`: <what requirement is changing>

## Impact

<!-- Affected code, APIs, dependencies, systems -->
```

The Capabilities section is critical. It establishes the contract between proposal and specs: each capability listed creates a corresponding delta spec file.

## specs/<capability>/spec.md (Delta Spec)

Delta specs describe only what is changing, not the full spec. Template from `schemas/spec-driven/templates/spec.md`:

```markdown
## ADDED Requirements

### Requirement: <!-- requirement name -->
<!-- requirement text -->

#### Scenario: <!-- scenario name -->
- **WHEN** <!-- condition -->
- **THEN** <!-- expected outcome -->
```

### Delta Sections

| Section header | Meaning |
|---|---|
| `## ADDED Requirements` | New requirements to add to main spec |
| `## MODIFIED Requirements` | Changes to existing requirements (must include full updated block) |
| `## REMOVED Requirements` | Requirements to delete from main spec |
| `## RENAMED Requirements` | Name-only changes, using `FROM:` / `TO:` format |

### Full Delta Spec Example

```markdown
## ADDED Requirements

### Requirement: Two-Factor Authentication
The system MUST support TOTP-based two-factor authentication.

#### Scenario: 2FA enrollment
- **WHEN** the user enables 2FA in settings
- **THEN** a QR code is displayed for authenticator app setup
- **AND** the user must verify with a code before activation

#### Scenario: 2FA login
- **WHEN** a user with 2FA enabled submits valid credentials
- **THEN** an OTP challenge is presented
- **AND** login completes only after valid OTP entry

## MODIFIED Requirements

### Requirement: Session Expiration
The system MUST expire sessions after 15 minutes of inactivity.
(Previously: 30 minutes)

#### Scenario: Idle timeout
- **WHEN** 15 minutes pass without activity while authenticated
- **THEN** the session is invalidated
- **AND** the user must re-authenticate

## REMOVED Requirements

### Requirement: Remember Me
**Reason**: Deprecated in favor of 2FA. Users should re-authenticate each session.
**Migration**: Remove any "Remember Me" UI elements.

## RENAMED Requirements

- FROM: `### Requirement: Basic Auth`
- TO: `### Requirement: Password Authentication`
```

### Formatting Rules

- Requirement headers: exactly `### Requirement: <Name>` (3 hashtags)
- Scenario headers: exactly `#### Scenario: <Name>` (4 hashtags — critical, 3 hashtags fails silently)
- Scenario lines: `- **WHEN**`, `- **THEN**`, `- **AND**`, `- **GIVEN**`
- Use SHALL/MUST for normative requirements (avoid "should" or "may" for non-optional behavior)
- Every requirement must have at least one scenario
- MODIFIED requirements must include the full updated content (not just changed parts)

## openspec/specs/<capability>/spec.md (Main Spec)

The canonical spec after delta merges. Full format:

```markdown
# Auth Specification

## Purpose
Authentication and session management for the application.

## Requirements

### Requirement: User Authentication
The system SHALL issue a JWT token upon successful login.

#### Scenario: Valid credentials
- GIVEN a user with valid credentials
- WHEN the user submits the login form
- THEN a JWT token is returned
- AND the user is redirected to the dashboard

#### Scenario: Invalid credentials
- GIVEN invalid credentials
- WHEN the user submits the login form
- THEN an error message is displayed
- AND no token is issued

### Requirement: Session Expiration
The system MUST expire sessions after 15 minutes of inactivity.

#### Scenario: Idle timeout
- GIVEN an authenticated session
- WHEN 15 minutes pass without activity
- THEN the session is invalidated
- AND the user must re-authenticate
```

## design.md

Technical decisions and architecture. Template from `schemas/spec-driven/templates/design.md`:

```markdown
## Context

<!-- Background and current state -->

## Goals / Non-Goals

**Goals:**
<!-- What this design aims to achieve -->

**Non-Goals:**
<!-- What is explicitly out of scope -->

## Decisions

<!-- Key design decisions and rationale -->

## Risks / Trade-offs

<!-- Known risks and trade-offs -->
```

Full section list (from schema instruction): Context, Goals/Non-Goals, Decisions (with alternatives considered), Risks/Trade-offs, Migration Plan, Open Questions.

Focus on architecture and rationale — why X over Y. Reference proposal for motivation and specs for requirements. Implementation details go in tasks.md, not design.md.

## tasks.md

Implementation checklist. Template from `schemas/spec-driven/templates/tasks.md`:

```markdown
## 1. <!-- Task Group Name -->

- [ ] 1.1 <!-- Task description -->
- [ ] 1.2 <!-- Task description -->

## 2. <!-- Task Group Name -->

- [ ] 2.1 <!-- Task description -->
- [ ] 2.2 <!-- Task description -->
```

Tasks must use `- [ ]` checkbox format. The apply phase parses these checkboxes to track progress. Tasks not using this format won't be tracked. Group related tasks under `## N. <Group>` headings with hierarchical numbering (1.1, 1.2, 2.1, etc.).

As tasks complete, checkboxes change: `- [ ]` → `- [x]`.

## Archive Layout

When a change is archived, the folder moves with a date prefix:

```
openspec/changes/archive/2025-01-24-add-dark-mode/
├── .openspec.yaml
├── proposal.md
├── design.md
├── tasks.md          (with all checkboxes marked [x])
└── specs/
    └── ui/
        └── spec.md   (original delta spec, preserved for history)
```

The archived change is a permanent record: proposal explains why, design explains how, tasks show what was done. The delta spec is preserved even after its contents have been merged into the main spec.
