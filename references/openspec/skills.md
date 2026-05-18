# Skills Reference

Skills are Markdown files installed into `.claude/skills/<skill-name>/SKILL.md` (and equivalent paths for other AI tools). Claude Code auto-discovers them; they define what the AI does when `/opsx:*` commands are invoked.

All 10 skills are installed by `openspec init` (for Claude, when delivery includes skills). Each SKILL.md has a YAML frontmatter block with name, description, license, compatibility, and metadata including the `generatedBy` version.

Skills are generated from TypeScript templates in `src/core/templates/workflows/` in the OpenSpec source, then written to disk during `init`/`update`. The installed content is static Markdown — the AI reads it and follows the instructions.

---

## openspec-new-change

**Trigger:** User invokes `/opsx:new [change-name]`

**Purpose:** Start a new change scaffold. Creates the change directory and shows the first artifact template without creating any artifacts yet.

**Steps the AI follows:**
1. If no name provided, ask with AskUserQuestion tool.
2. Determine schema (default unless user requests a specific one).
3. `openspec new change "<name>"` — creates `openspec/changes/<name>/` with `.openspec.yaml`.
4. `openspec status --change "<name>"` — show artifact statuses.
5. `openspec instructions <first-artifact-id> --change "<name>"` — get template for the first ready artifact.
6. **Stop and wait** — do not create any artifacts.

**Output:** Change name, location, schema, artifact sequence (0/N complete), and the first artifact template. Prompts user to describe the change.

**Guardrails:** Do NOT create artifacts. If name already exists, suggest continuing instead. If name is not kebab-case, ask for a valid name.

**CLI calls made:** `openspec new change`, `openspec status`, `openspec instructions`

---

## openspec-explore

**Trigger:** User invokes `/opsx:explore [topic]`

**Purpose:** Enter explore mode — a thinking partner for investigating problems, clarifying requirements, and comparing approaches. Not an implementation workflow.

**Behavior:**
- Reads `openspec list --json` at the start to understand active changes.
- May read codebase files, draw ASCII diagrams, compare options.
- If a change exists, reads its artifacts for context.
- Offers to capture insights into artifacts (proposal, design, specs, tasks) when the user decides to, but never auto-captures.
- Transitions to `/opsx:propose` (or `/opsx:new` in expanded mode) when insights crystallize.

**Stance (from SKILL.md):** Curious not prescriptive, open threads not interrogations, visual (ASCII diagrams), adaptive, patient, grounded in the actual codebase.

**Hard constraints:** Never write application code. Never create artifacts without user direction. Never fake understanding.

**CLI calls made:** `openspec list --json`, (reads artifact files directly)

---

## openspec-continue-change

**Trigger:** User invokes `/opsx:continue [change-name]`

**Purpose:** Create the next single artifact in the dependency chain. One artifact per invocation.

**Steps the AI follows:**
1. If no name provided, prompt using `openspec list --json` + AskUserQuestion.
2. `openspec status --change "<name>" --json` — check current state.
3. If `isComplete: true` — congratulate and stop.
4. If an artifact has `status: "ready"` — pick the first one.
5. `openspec instructions <artifact-id> --change "<name>" --json` — get template, context, rules, output path, dependencies.
6. Read dependency files for context.
7. Create the artifact file at `outputPath`, filling in the template.
8. `openspec status --change "<name>"` — show updated progress.
9. **Stop** — create only one artifact per invocation.

**Important:** `context` and `rules` from the instructions output are constraints for writing — they must NOT be copied into the artifact file.

**Output:** Which artifact was created, current progress (N/M), what artifacts are now unlocked.

**CLI calls made:** `openspec list --json`, `openspec status --json`, `openspec instructions --json`

---

## openspec-ff-change

**Trigger:** User invokes `/opsx:ff [change-name]`

**Purpose:** Fast-forward — create ALL artifacts needed for implementation in one operation, without stopping between artifacts.

**Steps:**
1. If no name provided, ask with AskUserQuestion.
2. `openspec new change "<name>"` — create the change.
3. `openspec status --change "<name>" --json` — get `applyRequires` (the artifacts needed before implementation).
4. Loop until all `applyRequires` artifacts are done:
   a. `openspec instructions <artifact-id> --change "<name>" --json`
   b. Read dependency files
   c. Create the artifact
   d. Re-check status
5. `openspec status --change "<name>"` — show final state.

Uses TodoWrite tool to track progress through the artifact sequence.

**Output:** Checklist of artifacts created, then "All artifacts created! Ready for implementation. Run `/opsx:apply`."

**Difference from openspec-new-change:** ff creates all artifacts; new only scaffolds the directory.

**CLI calls made:** `openspec new change`, `openspec status --json`, `openspec instructions --json`

---

## openspec-apply-change

**Trigger:** User invokes `/opsx:apply [change-name]`

**Purpose:** Implement tasks from a change. Works through the task checklist, writing code and marking tasks complete.

**Steps:**
1. Select change (infer from context, auto-select if only one, or prompt).
2. `openspec status --change "<name>" --json` — understand schema and which file contains tasks.
3. `openspec instructions apply --change "<name>" --json` — get context files, progress, task list, dynamic instruction.
   - If `state: "blocked"`: show message, suggest `openspec-continue-change`.
   - If `state: "all_done"`: congratulate, suggest archive.
4. Read all files listed in `contextFiles` (proposal, specs, design, tasks for spec-driven).
5. Show current progress (N/M tasks complete).
6. Loop through pending tasks:
   - Announce task being worked on
   - Make code changes
   - Mark task complete: `- [ ]` → `- [x]`
   - Continue to next task
   - Pause if: task unclear, design issue revealed, error/blocker encountered, user interrupts.
7. On completion or pause, show tasks completed this session and overall progress.

**Output (completion):**
```
## Implementation Complete
Change: <name> | Schema: <schema> | Progress: 7/7 tasks complete
### Completed This Session
- [x] Task 1 ...
```

**Output (pause):**
```
## Implementation Paused
Progress: 4/7 tasks complete
### Issue Encountered
<description>
Options: 1. ... 2. ... 3. ...
```

**Guardrails:** Always read context files before starting. Pause on errors, blockers, or unclear requirements — don't guess. Mark checkbox immediately after completing each task.

**CLI calls made:** `openspec list --json`, `openspec status --json`, `openspec instructions apply --json`

---

## openspec-archive-change

**Trigger:** User invokes `/opsx:archive [change-name]`

**Purpose:** Archive a completed change. Handles delta spec sync, completion checks, and moving the folder.

**Steps:**
1. If no name provided, prompt (do NOT auto-select).
2. `openspec status --change "<name>" --json` — check artifact completion. If any artifacts are not `done`, warn and confirm.
3. Read `tasks.md` — count `- [ ]` vs `- [x]`. If incomplete tasks, warn and confirm.
4. Check `openspec/changes/<name>/specs/` for delta specs.
   - If delta specs exist: compare each with its main spec counterpart, build summary, prompt: "Sync now (recommended)" or "Archive without syncing".
   - If user chooses sync: invoke `openspec-sync-specs` via Task tool (subagent).
5. `mkdir -p openspec/changes/archive`
6. `mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>`
7. Display summary.

**Important:** This skill uses `mv` — it does NOT call `openspec archive`. The spec merge is handled by the `openspec-sync-specs` skill invocation (or skipped). The CLI `openspec archive` command handles spec merging programmatically; this skill handles it agent-driven.

**Guardrails:** Never auto-select change. Don't block on warnings — just inform and confirm. Preserve `.openspec.yaml` (moves with the directory).

**CLI calls made:** `openspec list --json`, `openspec status --json` (reads artifact files and delta specs directly, uses `mv`)

---

## openspec-bulk-archive-change

**Trigger:** User invokes `/opsx:bulk-archive`

**Purpose:** Archive multiple changes at once with intelligent conflict resolution for overlapping delta specs.

**Steps:**
1. `openspec list --json` — get all active changes.
2. AskUserQuestion with multi-select — let user choose which changes to archive (or "All changes").
3. For each selected change, collect: artifact status (`openspec status --json`), task completion (read `tasks.md`), delta spec inventory (`specs/` directory).
4. Build conflict map: `capability → [changes touching it]`. A conflict is 2+ changes touching the same capability spec.
5. Resolve conflicts agentically: read delta specs, search codebase for implementation evidence, determine which change(s) are actually implemented and in what order.
6. Show consolidated status table (artifacts, tasks, specs, conflict status per change).
7. Single confirmation via AskUserQuestion.
8. For each change: sync specs (invoking `openspec-sync-specs` approach), then `mv` to archive.
9. Display final summary (archived, skipped, failed counts).

**Conflict resolution logic:**
- Only one change implemented → sync that one's specs only
- Both implemented → apply in chronological order (older first, newer overwrites)
- Neither implemented → skip spec sync, warn user

**Guardrails:** Allow any number of selections. Never auto-select. Use single confirmation for the batch. If archive target already exists, fail that change but continue with others.

**CLI calls made:** `openspec list --json`, `openspec status --json` (reads files directly, uses `mv`)

---

## openspec-sync-specs

**Trigger:** User invokes `/opsx:sync [change-name]`, or invoked by `openspec-archive-change` / `openspec-bulk-archive-change`.

**Purpose:** Merge delta specs from a change into the main `openspec/specs/` directory without archiving.

**Steps:**
1. If no name provided, prompt (show only changes with delta specs).
2. Find delta spec files at `openspec/changes/<name>/specs/*/spec.md`.
3. For each capability with a delta spec:
   a. Read the delta spec.
   b. Read the main spec at `openspec/specs/<capability>/spec.md` (may not exist yet).
   c. Apply changes intelligently:
      - **ADDED**: if requirement doesn't exist in main → add it; if it does → update it (implicit MODIFIED)
      - **MODIFIED**: find requirement in main, apply changes, preserve untouched scenarios
      - **REMOVED**: delete the entire requirement block
      - **RENAMED**: find FROM requirement, rename to TO
   d. If capability doesn't exist in main specs: create `openspec/specs/<capability>/spec.md` with Purpose section + ADDED requirements.
4. Show summary of what changed.

**Key principle: Intelligent merging.** Unlike copy-paste, this skill applies partial updates. A MODIFIED section that only shows a new scenario should add that scenario, not replace the entire requirement. The delta represents *intent*, not wholesale replacement.

**Idempotent:** Running sync twice should give the same result.

**CLI calls made:** `openspec list --json` (reads and writes files directly)

---

## openspec-verify-change

**Trigger:** User invokes `/opsx:verify [change-name]`

**Purpose:** Verify that implementation matches the change artifacts across three dimensions: Completeness, Correctness, Coherence.

**Steps:**
1. If no name provided, prompt (show changes with tasks; mark in-progress ones).
2. `openspec status --change "<name>" --json` — understand schema and artifacts.
3. `openspec instructions apply --change "<name>" --json` — get context files.
4. Read all artifact files from `contextFiles`.
5. **Verify Completeness:**
   - Task completion: count `- [ ]` vs `- [x]` in `tasks.md`. Incomplete tasks → CRITICAL issue.
   - Spec coverage: for each requirement in delta specs, search codebase for implementation evidence. Unimplemented → CRITICAL.
6. **Verify Correctness:**
   - Requirement mapping: for each requirement, verify implementation matches intent. Divergence → WARNING.
   - Scenario coverage: for each scenario, check if conditions are handled and tested. Uncovered → WARNING.
7. **Verify Coherence:**
   - Design adherence: if `design.md` exists, verify implementation follows key decisions. Contradiction → WARNING.
   - Pattern consistency: check new code against project patterns. Significant deviations → SUGGESTION.
8. Generate verification report with summary scorecard and issues grouped by CRITICAL/WARNING/SUGGESTION.

**Graceful degradation:** Only tasks.md → check task completion only. Tasks + specs → skip design. Full artifacts → all three dimensions.

**Output format:**
```
## Verification Report: <change-name>

### Summary
| Dimension    | Status           |
|--------------|------------------|
| Completeness | X/Y tasks, N reqs|
| Correctness  | M/N reqs covered |
| Coherence    | Followed/Issues  |

CRITICAL issues (must fix before archive): ...
WARNING issues (should fix): ...
SUGGESTION issues (nice to fix): ...

Final: "X critical issue(s) found." or "Ready for archive."
```

**CLI calls made:** `openspec list --json`, `openspec status --json`, `openspec instructions apply --json`

---

## openspec-onboard

**Trigger:** User invokes `/opsx:onboard`

**Purpose:** Guided onboarding — walk through a complete workflow cycle using a real task in the user's codebase, with narration at each step.

**Phases:**
1. **Welcome** — explain the workflow cycle, estimated time (~15-20 min).
2. **Task Selection** — scan codebase for improvement opportunities (TODO/FIXME, missing error handling, untested functions, `any` types, debug artifacts, missing validation). Present 3-4 suggestions. Check `git log --oneline -10`.
3. **Explore Demo** — briefly investigate the selected code, show ASCII diagram if helpful.
4. **Create Change** — `openspec new change "<derived-name>"`, explain the folder structure.
5. **Proposal** — draft, show for approval, save after approval.
6. **Specs** — create spec file using `openspec instructions specs --json`.
7. **Design** — create `design.md`.
8. **Tasks** — generate and save `tasks.md`.
9. **Apply** — implement each task with narration referencing specs/design.
10. **Archive** — `openspec archive "<name>"`, explain what archiving does.
11. **Recap** — summary of the cycle, command reference table, next steps.

**Pattern throughout:** EXPLAIN → DO → SHOW → PAUSE at key transitions.

**Guardrails:** Follow all phases even for small changes (teaching). Handle graceful exit if user stops mid-way. Offer quick command reference if user just wants to skip tutorial.

**CLI calls made:** `openspec --version`, `openspec new change`, `openspec instructions --json`, `openspec archive`
