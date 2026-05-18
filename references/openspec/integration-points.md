# Integration Points

This document covers how OpenSpec integrates with AI clients, the mechanisms skills and commands use to communicate with the CLI, and what a bot wrapper needs to understand.

## The Core Integration Pattern

OpenSpec is a **CLI-backed AI workflow**. The AI client (Claude Code, Cursor, etc.) reads skill/command files to understand what to do, then calls the `openspec` CLI for structured data, and finally acts on that data (writing files, running code).

```
┌─────────────────────────────────────────────────────────────┐
│                    AI CLIENT (Claude Code)                  │
│                                                             │
│  1. Reads .claude/skills/openspec-*/SKILL.md               │
│     (static Markdown — the "what to do" instructions)      │
│                                                             │
│  2. Calls CLI for structured data:                         │
│     - openspec status --change X --json                     │
│     - openspec instructions <artifact> --change X --json    │
│     - openspec list --json                                  │
│                                                             │
│  3. Reads/writes project files directly:                   │
│     - reads proposal.md, design.md, tasks.md               │
│     - writes artifact files                                 │
│     - runs: mkdir, mv (for archive)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
            │                         │
            ▼                         ▼
   openspec CLI              openspec/ directory
   (JSON output)             (artifact files)
```

The CLI does not drive the AI. The AI drives itself using instructions from skills, queries the CLI for state, and performs actions using file system operations and the CLI.

## Skill Installation

`openspec init` writes one SKILL.md per workflow into the tool-appropriate directory:

| AI Tool | Skills location | Commands location |
|---------|----------------|-------------------|
| Claude Code | `.claude/skills/openspec-<id>/SKILL.md` | `.claude/commands/opsx/<id>.md` |
| Cursor | `.cursor/rules/openspec-<id>.mdc` | `.cursor/rules/opsx-<id>.mdc` |
| Windsurf | `.windsurf/rules/openspec-<id>.md` | (varies) |
| GitHub Copilot | (skill format) | `.github/prompts/opsx-<id>.prompt.md` |
| Codex | (agent format) | — |
| (25+ others) | (tool-specific adapters) | — |

Skill content is generated from TypeScript templates in `src/core/templates/workflows/`. The installed SKILL.md files are static Markdown — they don't change unless you run `openspec update`.

`openspec update` regenerates all skill/command files using the current global profile and delivery settings. Run it after upgrading the npm package.

## The `openspec instructions` Mechanism

`openspec instructions <artifact> --change <name> --json` is the primary AI-native interface. It bundles everything the AI needs to create an artifact:

```json
{
  "artifact": "design",
  "outputPath": "openspec/changes/add-dark-mode/design.md",
  "template": "## Context\n\n<!-- Background... -->\n\n## Goals...",
  "instruction": "Create the design document that explains HOW to implement...",
  "context": "Tech stack: TypeScript, React...",
  "rules": ["Include sequence diagrams for complex flows"],
  "dependencies": [
    {
      "id": "proposal",
      "path": "openspec/changes/add-dark-mode/proposal.md",
      "status": "done"
    }
  ]
}
```

The AI:
1. Uses `template` as the structure for the output file (fills in the sections)
2. Applies `context` and `rules` as constraints (but does NOT copy them into the output file)
3. Reads `dependencies` files for context before writing
4. Writes the artifact to `outputPath`

For the `apply` pseudo-artifact, the output includes `contextFiles` (all artifact paths to read), `state`, and task progress data.

## `openspec status --json` for State Queries

Skills call this to understand the current artifact graph state before deciding what to do:

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

Skills use this to: determine next artifact to create, check if apply is available, generate progress summaries, and decide whether to warn the user.

## `openspec list --json` for Change Discovery

Returns the list of active changes (sorted by recently modified):

```json
[
  {
    "name": "add-dark-mode",
    "lastModified": "2025-01-24T12:00:00Z",
    "schema": "spec-driven"
  },
  {
    "name": "fix-login-redirect",
    "lastModified": "2025-01-23T09:00:00Z",
    "schema": "spec-driven"
  }
]
```

Skills use this for: change selection when no name is specified, building the AskUserQuestion options list, determining the most recently modified change.

## Delivery Modes

The global `delivery` config controls what `openspec init`/`update` writes:

| Delivery | What gets written |
|----------|-------------------|
| `both` (default) | Skills in `.claude/skills/` AND commands in `.claude/commands/opsx/` |
| `skills` | Only `.claude/skills/openspec-*/SKILL.md` |
| `commands` | Only `.claude/commands/opsx/*.md` |

Both commands and skills contain the same instruction body. The difference is invocation method: skills are auto-discovered and can be triggered by name in conversation; commands appear in the slash command picker (`/opsx:*`).

## AI Client Support Matrix

30+ tools are supported via adapters in `src/core/command-generation/adapters/`:

- Amazon Q, Antigravity, Auggie, Bob, Claude (Code), Cline, Codebuddy, Codex, Continue, Costrict, Crush, Cursor, Factory, Gemini, GitHub Copilot, iFlow, Junie, Kilocode, Kiro, Lingma, OpenCode, Pi, Qoder, Qwen, Roocode, Trae, Windsurf

Each adapter implements `getFilePath(commandId)` and `formatFile(content)`. The instruction body is tool-agnostic; only the file path and frontmatter format differ.

**Note on GitHub Copilot:** Prompt files (`.github/prompts/*.prompt.md`) only work in IDE extensions (VS Code, JetBrains, Visual Studio), not in GitHub Copilot CLI.

**Note on Kimi CLI and Trae:** These use skill-based invocations rather than generated command files.

## Project Config as AI Context Injection

`openspec/config.yaml` is the mechanism for injecting project-specific context into all artifact instructions:

```yaml
context: |
  Tech stack: TypeScript, React, Node.js
  Testing: Vitest + Playwright
  Conventions: conventional commits, kebab-case filenames
```

This context is prepended to every `openspec instructions` output as a `<context>` XML block. It shapes how the AI writes artifacts without requiring prompt engineering in each command invocation.

Per-artifact `rules` are injected similarly but only for matching artifacts.

## For Bot Wrappers

If you're building a bot or automation that wraps OpenSpec:

**Read skill instructions**: The SKILL.md files in `.claude/skills/openspec-*/` are the canonical instructions. Read them to understand what your bot should do for each workflow.

**Use CLI JSON output**: All actionable state comes from:
- `openspec list --json` — what changes exist
- `openspec status --change X --json` — artifact DAG state
- `openspec instructions <artifact> --change X --json` — template + context + output path
- `openspec schemas --json` — available schemas

**File operations are direct**: Skills write artifacts directly using filesystem operations, not through the CLI. Archive is done via `mv`. Spec sync is done by reading/writing Markdown files. Your bot should do the same.

**Context files must be read**: Before creating any artifact or implementing tasks, the bot must read the context files listed in the `dependencies` (for artifact creation) or `contextFiles` (for apply) fields from the instructions output. Skipping this produces low-quality output.

**AskUserQuestion**: Skills frequently pause to ask the user a question before proceeding. In a bot context, you'll need to handle these decision points explicitly (e.g., always confirm, always select most recent change, etc.).

**Schema awareness**: Don't hardcode artifact names. Use `openspec status --json` to determine artifact IDs and `openspec instructions --json` to get output paths. This makes your bot work with custom schemas.

## Telemetry

OpenSpec collects anonymous telemetry: command names and version only. No arguments, paths, file content, or PII. Disabled in CI automatically.

Opt-out:
```bash
export OPENSPEC_TELEMETRY=0
# or
export DO_NOT_TRACK=1
```

Telemetry uses PostHog (`posthog-node` dependency in package.json).

## Version Compatibility

The installed skills/commands include a `generatedBy` metadata field with the CLI version that created them (e.g., `"1.3.0"`). After upgrading the CLI, run `openspec update` to regenerate skills/commands to match the new version's instructions.

Skills also carry:
```yaml
compatibility: Requires openspec CLI.
license: MIT
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.3.0"
```
