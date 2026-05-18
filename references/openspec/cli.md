# CLI Reference

The `openspec` CLI (package `@fission-ai/openspec`, binary `openspec`) is the terminal interface for project setup, lifecycle management, and providing enriched instructions to AI agents.

Current version: **1.3.0** (installed), 1.3.1 (latest on npm).

## Global Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Print version number |
| `--no-color` | Disable color output |
| `-h, --help` | Help for any command |

Environment variables:
| Variable | Effect |
|----------|--------|
| `OPENSPEC_TELEMETRY=0` | Disable telemetry |
| `DO_NOT_TRACK=1` | Disable telemetry (standard DNT signal) |
| `OPENSPEC_CONCURRENCY` | Default parallelism for bulk validation (default: 6) |
| `EDITOR` or `VISUAL` | Editor for `openspec config edit` |
| `NO_COLOR` | Disable color when set |

Telemetry collects only command names and version — no arguments, paths, or content. Automatically disabled in CI.

## Human vs Agent Commands

Some commands are interactive-only; others support `--json` for agent/script consumption.

**Agent-compatible (support `--json`):** `list`, `show`, `validate`, `status`, `instructions`, `templates`, `schemas`, `workspace setup --no-interactive`, `workspace list`, `workspace link`, `workspace relink`, `workspace doctor`.

**Human-only (interactive):** `init`, `view`, `config edit`, `feedback`, `completion install`.

---

## Setup Commands

### `openspec init [path]`

Initialize OpenSpec in a project. Creates `openspec/specs/`, `openspec/changes/`, `openspec/config.yaml`, and installs AI tool integrations (skills/commands).

```bash
openspec init                        # interactive
openspec init ./my-project           # target directory
openspec init --tools claude,cursor  # non-interactive, specific tools
openspec init --tools all            # all 30+ supported tools
openspec init --profile core         # override global profile for this run
openspec init --force                # auto-cleanup legacy files
```

**Options:**

| Option | Description |
|--------|-------------|
| `--tools <list>` | `all`, `none`, or comma-separated tool IDs |
| `--force` | Auto-cleanup legacy files without prompting |
| `--profile <profile>` | `core` or `custom` — overrides global config for this run |

**Supported tool IDs:** `amazon-q`, `antigravity`, `auggie`, `bob`, `claude`, `cline`, `codex`, `forgecode`, `codebuddy`, `continue`, `costrict`, `crush`, `cursor`, `factory`, `gemini`, `github-copilot`, `iflow`, `junie`, `kilocode`, `kimi`, `kiro`, `opencode`, `pi`, `qoder`, `lingma`, `qwen`, `roocode`, `trae`, `windsurf`.

Default behavior when run with no options: uses global config defaults (profile `core`, delivery `both`, workflows `propose, explore, apply, sync, archive`).

**What it creates:**
```
openspec/
├── specs/
├── changes/
└── config.yaml

.claude/skills/openspec-*/SKILL.md   (if claude selected, delivery=both|skills)
.claude/commands/opsx/*.md           (if claude selected, delivery=both|commands)
```

---

### `openspec update [path]`

Regenerate AI tool configuration files after upgrading the CLI. Uses current global profile, selected workflows, and delivery mode.

```bash
npm install -g @fission-ai/openspec@latest
openspec update          # regenerate skills/commands in current directory
openspec update --force  # force even if files appear current
```

---

## Browsing Commands

### `openspec list`

List active changes or specs.

```bash
openspec list              # list active changes (default)
openspec list --specs      # list specs
openspec list --json       # JSON output for scripts/agents
openspec list --sort name  # sort alphabetically (default: recent)
```

**Options:** `--specs`, `--changes`, `--sort <recent|name>`, `--json`.

**JSON output shape:**
```json
[
  {
    "name": "add-dark-mode",
    "lastModified": "2025-01-24T...",
    "schema": "spec-driven"
  }
]
```

---

### `openspec view`

Interactive terminal dashboard for browsing specs and changes. Human-only.

```bash
openspec view
```

---

### `openspec show [item-name]`

Display details of a change or spec. Prompts interactively if name omitted.

```bash
openspec show                          # interactive selection
openspec show add-dark-mode            # specific change
openspec show auth --type spec         # specific spec
openspec show add-dark-mode --json     # JSON output
openspec show add-dark-mode --json --deltas-only   # only delta specs (change)
openspec show auth --json --requirements            # only requirements, no scenarios
openspec show auth --json -r 2         # specific requirement by 1-based index
```

**Options:** `--type <change|spec>`, `--json`, `--no-interactive`, `--deltas-only` (change, JSON), `--requirements` (spec, JSON), `--no-scenarios` (spec, JSON), `-r/--requirement <id>` (spec, JSON).

---

## Validation Commands

### `openspec validate [item-name]`

Validate changes and specs for structural issues.

```bash
openspec validate                     # interactive
openspec validate add-dark-mode       # specific change
openspec validate --changes           # all changes
openspec validate --all --json        # all items, JSON output (CI use)
openspec validate --all --strict --concurrency 12
```

**Options:** `--all`, `--changes`, `--specs`, `--type <change|spec>`, `--strict`, `--json`, `--concurrency <n>`, `--no-interactive`.

**JSON output:**
```json
{
  "version": "1.0.0",
  "results": {
    "changes": [{ "name": "add-dark-mode", "valid": true, "warnings": [] }]
  },
  "summary": { "total": 1, "valid": 1, "invalid": 0 }
}
```

---

## Lifecycle Commands

### `openspec archive [change-name]`

Archive a completed change. Merges delta specs into `openspec/specs/`, then moves the change folder to `openspec/changes/archive/YYYY-MM-DD-<name>/`.

```bash
openspec archive                      # interactive selection
openspec archive add-dark-mode        # specific change
openspec archive add-dark-mode --yes  # skip confirmation (CI)
openspec archive update-ci --skip-specs   # skip spec merge (no spec changes)
openspec archive add-dark-mode --no-validate  # skip validation (requires confirmation)
```

**Options:**
| Option | Description |
|--------|-------------|
| `-y, --yes` | Skip confirmation prompts |
| `--skip-specs` | Skip spec update (for infrastructure/tooling/doc-only changes) |
| `--no-validate` | Skip validation (requires confirmation) |

**What it does:**
1. Validates the change (unless `--no-validate`)
2. Prompts for confirmation (unless `--yes`)
3. Merges delta specs into `openspec/specs/`
4. Moves change folder to `openspec/changes/archive/YYYY-MM-DD-<name>/`

Note: The `openspec-archive-change` skill does the archive differently (agent-driven, uses `mv`). The CLI command does the spec merge programmatically.

---

## Workflow Commands

These commands power the OPSX workflow. Skills call them to get structured data.

### `openspec status`

Display artifact completion status for a change.

```bash
openspec status --change add-dark-mode
openspec status --change add-dark-mode --json
openspec status --change add-dark-mode --schema my-workflow  # schema override
```

**Options:** `--change <id>` (required non-interactively), `--schema <name>`, `--json`.

**JSON output:**
```json
{
  "changeName": "add-dark-mode",
  "schemaName": "spec-driven",
  "isComplete": false,
  "applyRequires": ["tasks"],
  "artifacts": [
    { "id": "proposal", "outputPath": "proposal.md", "status": "done" },
    { "id": "design", "outputPath": "design.md", "status": "ready" },
    { "id": "specs", "outputPath": "specs/**/*.md", "status": "done" },
    { "id": "tasks", "outputPath": "tasks.md", "status": "blocked", "missingDeps": ["design"] }
  ]
}
```

Artifact statuses: `done` (file exists), `ready` (all dependencies done), `blocked` (dependencies missing).

---

### `openspec instructions [artifact]`

Get enriched instructions for creating an artifact or applying tasks. This is the primary mechanism by which skills get AI-ready content from the CLI.

```bash
openspec instructions --change add-dark-mode          # next ready artifact
openspec instructions proposal --change add-dark-mode  # specific artifact
openspec instructions design --change add-dark-mode --json
openspec instructions apply --change add-dark-mode --json  # apply/implementation instructions
```

**Arguments:** artifact ID (`proposal`, `specs`, `design`, `tasks`, or `apply`).

**Options:** `--change <id>`, `--schema <name>`, `--json`.

**JSON output includes:**
- `template`: the artifact template content (Markdown)
- `context`: project context from `config.yaml` (constraints for AI, not for copying into output)
- `rules`: per-artifact rules from `config.yaml` (same — constraints, not output content)
- `instruction`: schema-defined guidance for this artifact type
- `outputPath`: where to write the artifact file
- `dependencies`: list of completed dependency artifacts with their paths
- For `apply`: `contextFiles`, `state`, progress data, task list

The `context` and `rules` fields are injected as `<context>` and `<rules>` XML tags — they constrain what the AI writes but must not be copied into the output file.

---

### `openspec templates`

Show resolved template file paths for all artifacts in a schema.

```bash
openspec templates                        # default schema (spec-driven)
openspec templates --schema my-workflow   # custom schema
openspec templates --json
```

**Options:** `--schema <name>`, `--json`.

---

### `openspec schemas`

List available workflow schemas.

```bash
openspec schemas
openspec schemas --json
```

**JSON output (current installed instance):**
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

---

## Schema Management Commands

### `openspec schema init <name>`

Create a new project-local schema from scratch (interactive or non-interactive).

```bash
openspec schema init research-first
openspec schema init rapid \
  --description "Rapid iteration workflow" \
  --artifacts "proposal,tasks" \
  --default
```

**Options:** `--description <text>`, `--artifacts <list>`, `--default`, `--no-default`, `--force`, `--json`.

Creates `openspec/schemas/<name>/schema.yaml` and `templates/` directory.

---

### `openspec schema fork <source> [name]`

Copy an existing schema to the project for customization.

```bash
openspec schema fork spec-driven my-workflow
```

**Options:** `--force`, `--json`.

---

### `openspec schema validate [name]`

Validate a schema's structure and templates.

```bash
openspec schema validate my-workflow   # specific schema
openspec schema validate               # all schemas
```

Checks: `schema.yaml` syntax, all referenced templates exist, no circular dependencies, valid artifact IDs.

**Options:** `--verbose`, `--json`.

---

### `openspec schema which [name]`

Show where a schema resolves from (debugging schema precedence).

```bash
openspec schema which spec-driven
openspec schema which --all
```

**Schema resolution precedence:**
1. Project: `openspec/schemas/<name>/`
2. User: `~/.local/share/openspec/schemas/<name>/`
3. Package: built-in schemas

---

## Configuration Commands

### `openspec config`

View and modify global OpenSpec configuration. Config lives at `~/.config/openspec/config.json` (XDG) or `%APPDATA%/openspec/config.json` (Windows).

```bash
openspec config path           # show config file location
openspec config list           # show all current settings
openspec config get telemetry.enabled
openspec config set telemetry.enabled false
openspec config set user.name "My Name" --string
openspec config unset user.name
openspec config reset --all --yes
openspec config edit           # open in $EDITOR
openspec config profile        # interactive wizard
openspec config profile core   # preset shortcut
```

**Global config fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `profile` | `core` \| `custom` | `core` | Which workflow set to install |
| `delivery` | `both` \| `skills` \| `commands` | `both` | What to install |
| `workflows` | string[] | (from profile) | Selected workflows (custom profile) |
| `featureFlags` | object | `{}` | Internal feature flags |

**`openspec config profile`** starts an interactive wizard showing current state then offering: change delivery + workflows, change delivery only, change workflows only, keep current. After making changes, it offers to run `openspec update` for the current project.

---

## New Change Command

### `openspec new change <name>`

Create a new change directory (scaffolding only, no artifacts).

```bash
openspec new change add-dark-mode
openspec new change add-dark-mode --schema research-first
```

**Options:** `--schema <name>`, `--json`.

Creates `openspec/changes/<name>/` with a `.openspec.yaml` metadata file recording the schema and creation date.

---

## Utility Commands

### `openspec feedback <message>`

Submit feedback as a GitHub issue. Requires `gh` CLI installed and authenticated.

```bash
openspec feedback "Add custom artifact types" --body "Detailed description..."
```

---

### `openspec completion`

Manage shell completions.

```bash
openspec completion install         # auto-detect shell
openspec completion install zsh
openspec completion generate bash > ~/.bash_completion.d/openspec
openspec completion uninstall
```

Supported shells: `bash`, `zsh`, `fish`, `powershell`.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (validation failure, missing files, etc.) |

---

## Workspace Commands (Beta)

Under active development — do not build production automation on these.

```bash
openspec workspace setup [--no-interactive --name <n> --link <path>]
openspec workspace list [--json]
openspec workspace ls [--json]
openspec workspace link [name] <path>
openspec workspace relink <name> <path>
openspec workspace doctor [--workspace <name>]
openspec workspace open [name] [--agent <tool>] [--editor]
```

See [concepts.md](concepts.md) for workspace concepts.
