# Workflows Reference

## What a Schema Is

A **schema** is a YAML file (plus Markdown templates) that defines the artifact types in a workflow, their dependency order, and the instructions/templates used to create them. The schema drives everything: `openspec status`, `openspec instructions`, `openspec templates`, and all OPSX skills use the schema to determine what to create and in what order.

## The `spec-driven` Schema (Built-in Default)

The only built-in schema. Source: `schemas/spec-driven/schema.yaml` in the OpenSpec package.

```yaml
name: spec-driven
version: 1
description: Default OpenSpec workflow - proposal → specs → design → tasks
```

### Artifact DAG

```
             proposal
            (root node)
                |
      ┌─────────┴─────────┐
      |                   |
      ▼                   ▼
   specs               design
(requires:           (requires:
  proposal)            proposal)
      |                   |
      └─────────┬─────────┘
                |
                ▼
             tasks
           (requires:
           specs, design)
                |
                ▼
         APPLY PHASE
         (requires: tasks)
```

### Artifacts in `spec-driven`

| ID | Generates | Requires | Purpose |
|----|-----------|----------|---------|
| `proposal` | `proposal.md` | (none) | Intent, scope, capabilities |
| `specs` | `specs/**/*.md` | `proposal` | Delta specs for each capability |
| `design` | `design.md` | `proposal` | Technical decisions |
| `tasks` | `tasks.md` | `specs`, `design` | Implementation checklist |

**apply** section:
```yaml
apply:
  requires: [tasks]
  tracks: tasks.md
  instruction: |
    Read context files, work through pending tasks, mark complete as you go.
    Pause if you hit blockers or need clarification.
```

### Schema Instructions (used by `openspec instructions --json`)

Each artifact has a multi-line `instruction` field in `schema.yaml`. These are the AI-facing directions for creating each artifact type:

**proposal** instruction summary: Create the proposal document establishing WHY. Sections: Why, What Changes, Capabilities (New/Modified), Impact. The Capabilities section is critical — each capability listed needs a corresponding spec file. Keep concise (1-2 pages), focus on "why" not "how".

**specs** instruction summary: Create one spec file per capability in the proposal's Capabilities section. Use delta sections (ADDED/MODIFIED/REMOVED/RENAMED). Format: `### Requirement: <name>` (3 #) then `#### Scenario: <name>` (4 # — critical). Use SHALL/MUST. Every requirement needs at least one scenario. MODIFIED requirements must include the full updated content.

**design** instruction summary: Create the design doc explaining HOW. Only create if: cross-cutting change, new external dependency, significant data model change, security/performance complexity, or beneficial ambiguity resolution. Sections: Context, Goals/Non-Goals, Decisions (with rationale + alternatives), Risks/Trade-offs, Migration Plan, Open Questions.

**tasks** instruction summary: Break implementation into checkbox tasks. Follow `- [ ] X.Y Task description` format exactly (apply phase parses checkboxes). Group under `## N. <Group>` headings. Order by dependency. Reference specs for what to build, design for how.

### Templates

Physical template files are in `schemas/spec-driven/templates/`:

- `proposal.md` — Why / What Changes / Capabilities / Impact
- `spec.md` — `## ADDED Requirements` / `### Requirement:` / `#### Scenario:` stubs
- `design.md` — Context / Goals/Non-Goals / Decisions / Risks/Trade-offs stubs
- `tasks.md` — `## 1. Group` / `- [ ] 1.1` checkbox stubs

## `openspec status` Output

Used by skills to understand artifact state:

```json
{
  "changeName": "add-dark-mode",
  "schemaName": "spec-driven",
  "isComplete": false,
  "applyRequires": ["tasks"],
  "artifacts": [
    { "id": "proposal", "outputPath": "proposal.md", "status": "done" },
    { "id": "specs", "outputPath": "specs/**/*.md", "status": "done" },
    { "id": "design", "outputPath": "design.md", "status": "ready" },
    { "id": "tasks", "outputPath": "tasks.md", "status": "blocked", "missingDeps": ["design"] }
  ]
}
```

**Status values:**
- `done` — artifact file exists on the filesystem
- `ready` — all dependencies have `done` status
- `blocked` — one or more dependencies are not `done`

`applyRequires` lists which artifacts must be `done` before implementation can start. `isComplete` is true when all artifacts are `done`.

## `openspec instructions` Output

Used by skills to get AI-ready content. Example for `design` artifact:

```json
{
  "artifact": "design",
  "outputPath": "openspec/changes/add-dark-mode/design.md",
  "template": "## Context\n\n<!-- Background and current state -->\n\n...",
  "instruction": "Create the design document that explains HOW...",
  "context": "Tech stack: TypeScript, React...",
  "rules": ["Include sequence diagrams for complex flows"],
  "dependencies": [
    { "id": "proposal", "path": "openspec/changes/add-dark-mode/proposal.md", "status": "done" }
  ]
}
```

For the `apply` pseudo-artifact:

```json
{
  "state": "pending",
  "contextFiles": [
    "openspec/changes/add-dark-mode/proposal.md",
    "openspec/changes/add-dark-mode/specs/ui/spec.md",
    "openspec/changes/add-dark-mode/design.md",
    "openspec/changes/add-dark-mode/tasks.md"
  ],
  "progress": { "total": 8, "complete": 3, "remaining": 5 },
  "tasks": [...],
  "instruction": "Read context files, work through pending tasks..."
}
```

`state` values for apply: `"blocked"` (required artifacts missing), `"all_done"` (all tasks complete), `"pending"` (tasks remain).

## Custom Schemas

You can create project-local schemas that override or supplement the built-in one.

### Schema File Structure

```
openspec/schemas/<name>/
├── schema.yaml
└── templates/
    ├── proposal.md
    ├── tasks.md
    └── (any artifact templates referenced in schema.yaml)
```

### Schema YAML Format

```yaml
name: my-workflow
version: 1
description: My team's custom workflow

artifacts:
  - id: research
    generates: research.md
    description: Research document
    template: research.md         # references templates/research.md
    instruction: |
      Create a research document exploring the problem space.
    requires: []

  - id: proposal
    generates: proposal.md
    description: Change proposal
    template: proposal.md
    instruction: |
      Create a proposal based on the research findings.
    requires:
      - research

  - id: tasks
    generates: tasks.md
    description: Implementation checklist
    template: tasks.md
    requires:
      - proposal

apply:
  requires: [tasks]
  tracks: tasks.md
  instruction: |
    Read context files, work through pending tasks, mark complete as you go.
```

**Key schema fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique schema identifier (kebab-case) |
| `version` | Yes | Schema version (integer) |
| `description` | No | Human-readable description |
| `artifacts[].id` | Yes | Artifact identifier (used in CLI commands and config rules) |
| `artifacts[].generates` | Yes | Output file path (supports glob `specs/**/*.md`) |
| `artifacts[].template` | Yes | Template file name in `templates/` directory |
| `artifacts[].instruction` | No | AI instructions for creating this artifact |
| `artifacts[].requires` | Yes | Dependencies (other artifact IDs) |
| `apply.requires` | Yes | Which artifacts must exist before implementation |
| `apply.tracks` | Yes | Which file tracks task completion |
| `apply.instruction` | No | AI instructions for the apply phase |

### Creating Schemas

```bash
# Fork existing schema (recommended starting point)
openspec schema fork spec-driven my-workflow

# Create from scratch
openspec schema init research-first
openspec schema init rapid --description "Rapid workflow" --artifacts "proposal,tasks" --default

# Validate
openspec schema validate my-workflow

# Check resolution
openspec schema which my-workflow
openspec schema which --all
```

### Schema Resolution Order

1. CLI flag: `--schema <name>`
2. Change metadata: `.openspec.yaml` in the change folder
3. Project config: `openspec/config.yaml` → `schema: <name>`
4. Default: `spec-driven`

Resolution location precedence:
1. Project: `openspec/schemas/<name>/`
2. User: `~/.local/share/openspec/schemas/<name>/`
3. Package: built-in

### Available Schemas (Current Instance)

From `openspec schemas --json`:

```json
[
  {
    "name": "spec-driven",
    "description": "Default OpenSpec workflow - proposal → specs → design → tasks",
    "artifacts": ["proposal", "specs", "design", "tasks"],
    "source": "package"
  }
]
```

## Two Workflow Modes

**Core profile** (default for new installs):

```
/opsx:propose → /opsx:apply → /opsx:sync → /opsx:archive
```

`propose` combines `new` + `ff` into one command.

**Expanded/custom profile** (opt-in):

```
/opsx:explore → /opsx:new → /opsx:continue (or /opsx:ff) → /opsx:apply → /opsx:verify → /opsx:archive
```

Expanded adds: `new`, `continue`, `ff`, `verify`, `bulk-archive`, `onboard`.

Enable with: `openspec config profile` then `openspec update`.

## Dependencies as Enablers (Not Gates)

The schema dependency graph shows what's *possible* to create, not what's *required* next. You can:
- Skip `design.md` if the change doesn't need it (tasks won't be blocked on it if design is marked done somehow, or you can set the schema to not require design)
- Create `specs` before or after `design` — both just need `proposal` first
- Update earlier artifacts after later ones are created
- Apply (implement) even if some artifacts are missing — skills will check and warn, not hard-block

The system tracks completion by filesystem presence of the output file. If `design.md` exists, `design` is `done`, regardless of content.
