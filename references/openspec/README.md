# OpenSpec Reference

OpenSpec (`@fission-ai/openspec`, v1.3.x) is an AI-native spec-driven development tool that adds a lightweight planning layer between human intent and AI implementation. It organizes work into **changes** (folders containing artifacts: proposal, specs, design, tasks) that live in `openspec/changes/`, with **delta specs** that merge into a canonical `openspec/specs/` source of truth on archive. AI coding assistants interact with it via slash commands (`/opsx:propose`, `/opsx:apply`, etc.) backed by skills and commands installed into tool-specific directories (e.g., `.claude/skills/`, `.claude/commands/`).

## Files in This Reference

- [concepts.md](concepts.md) — Core concepts: changes, specs, artifacts, delta format, schemas, the archive lifecycle, and coordination workspaces.
- [cli.md](cli.md) — Full CLI reference. Every subcommand with purpose, flags, and examples.
- [skills.md](skills.md) — All 10 skills installed into `.claude/skills/` by `openspec init`. What each does, inputs, outputs, CLI calls it makes.
- [commands.md](commands.md) — The `/opsx:*` slash commands installed into `.claude/commands/opsx/`. How they map to skills and what the installed instance looks like.
- [artifacts.md](artifacts.md) — File layout, artifact templates, and the delta spec format with real examples.
- [workflows.md](workflows.md) — Workflow schemas: the `spec-driven` default, the DAG structure, how status and instructions work, and how to create custom schemas.
- [usage-patterns.md](usage-patterns.md) — End-to-end flow: idea → new change → artifacts → apply → archive, with real commands.
- [integration-points.md](integration-points.md) — How OpenSpec integrates with AI clients: skill/command installation, `openspec instructions` enriched-prompt mechanism, multi-tool support.
