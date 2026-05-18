# Commands Reference

OpenSpec installs slash commands for AI coding assistants. For Claude Code, these live at `.claude/commands/opsx/*.md`. Each file has YAML frontmatter (name, description, category, tags) followed by the same instruction body as the corresponding skill.

## Installed Commands (Claude Code)

The installed instance at `/Users/Dave_Kerr/repos/scratch/openspec-flow/` has the following files under `.claude/commands/opsx/`:

```
.claude/commands/opsx/
├── apply.md
├── archive.md
├── bulk-archive.md
├── continue.md
├── explore.md
├── ff.md
├── new.md
├── onboard.md
├── sync.md
└── verify.md
```

Note: `propose.md` is absent from this instance. (inferred: this project was initialized with the expanded workflow set, which does not include `propose` — or `propose` maps to the `ff` command in this configuration.)

## Command → Skill Mapping

Each command file's body is identical to the corresponding skill's SKILL.md. The difference is delivery mechanism: skills are auto-discovered by the AI client; commands are invoked via slash syntax.

| Command file | Slash invocation | Maps to skill |
|---|---|---|
| `apply.md` | `/opsx:apply [change-name]` | `openspec-apply-change` |
| `archive.md` | `/opsx:archive [change-name]` | `openspec-archive-change` |
| `bulk-archive.md` | `/opsx:bulk-archive` | `openspec-bulk-archive-change` |
| `continue.md` | `/opsx:continue [change-name]` | `openspec-continue-change` |
| `explore.md` | `/opsx:explore [topic]` | `openspec-explore` |
| `ff.md` | `/opsx:ff [change-name]` | `openspec-ff-change` |
| `new.md` | `/opsx:new [change-name]` | `openspec-new-change` |
| `onboard.md` | `/opsx:onboard` | `openspec-onboard` |
| `sync.md` | `/opsx:sync [change-name]` | `openspec-sync-specs` |
| `verify.md` | `/opsx:verify [change-name]` | `openspec-verify-change` |

## Command File Format (Claude Code)

Each file follows this structure:

```markdown
---
name: "OPSX: Apply"
description: Implement tasks from an OpenSpec change (Experimental)
category: Workflow
tags: [workflow, artifacts, experimental]
---

[same instruction body as SKILL.md, without frontmatter]
```

The Claude adapter (`src/core/command-generation/adapters/claude.ts`) writes files to `.claude/commands/opsx/<id>.md` with this frontmatter format.

## Core vs Expanded Profile

The global profile setting determines which commands get installed:

**`core` profile** (default) installs:
- `propose` (fast path: create change + all artifacts in one step)
- `explore`
- `apply`
- `sync`
- `archive`

**`custom` profile** (expanded) can add:
- `new` (scaffold only)
- `continue` (one artifact at a time)
- `ff` (fast-forward all artifacts)
- `verify` (pre-archive check)
- `bulk-archive` (batch archive)
- `onboard` (guided tutorial)

To enable expanded commands:
```bash
openspec config profile   # interactive wizard
openspec update           # regenerate files
```

## `/opsx:propose` Command

The `propose` command (part of the core profile) is the primary entry point. It combines the scaffold + fast-forward into a single command:

From the commands docs:
```
/opsx:propose add-dark-mode
```
Creates `openspec/changes/add-dark-mode/` and generates all planning artifacts (proposal, specs, design, tasks) in one go. Equivalent to `/opsx:new` + `/opsx:ff` in expanded mode. This command maps to the `openspec-ff-change` skill logic (including the `openspec new change` step) but is called "propose" to emphasize the planning intent.

## Cross-Tool Command Syntax

Commands are named consistently across tools, but the slash syntax varies:

| Tool | Example syntax |
|------|----------------|
| Claude Code | `/opsx:propose`, `/opsx:apply` |
| Cursor | `/opsx-propose`, `/opsx-apply` |
| Windsurf | `/opsx-propose`, `/opsx-apply` |
| GitHub Copilot (IDE) | `/opsx-propose`, `/opsx-apply` |
| Kimi CLI | Skill-based: `/skill:openspec-propose` |
| Trae | Skill-based: `/openspec-propose` |

The command file format differs per tool (e.g., Cursor uses `.cursor/rules/`, Copilot uses `.github/prompts/*.prompt.md` for IDE extensions).

## Legacy Commands

The old workflow used different command names. These still work but are superseded by OPSX:

| Old command | Replacement |
|---|---|
| `/openspec:proposal` | `/opsx:propose` (or `/opsx:new` + `/opsx:ff`) |
| `/openspec:apply` | `/opsx:apply` |
| `/openspec:archive` | `/opsx:archive` |

The artifact structure is compatible between old and new commands.

## What Commands vs Skills Do

Both commands and skills contain the same instruction body. The difference:

- **Skills** (`.claude/skills/*/SKILL.md`) are auto-discovered by Claude Code and can be invoked by name in conversation, or referenced by the AI autonomously.
- **Commands** (`.claude/commands/opsx/*.md`) appear in the slash command picker and are explicitly invocable with `/opsx:<id>`.

When `delivery` is `both` (the default), both are installed and the same instructions are available via both mechanisms.
