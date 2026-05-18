# Usage Patterns

End-to-end flows with real commands. The examples below assume Claude Code with the expanded workflow profile installed.

## Core Profile Flow (Default)

The simplest path. New installs get this by default.

```
/opsx:propose → /opsx:apply → /opsx:archive
```

```
You: /opsx:propose add-dark-mode

AI:  Created openspec/changes/add-dark-mode/
     ✓ proposal.md
     ✓ specs/ui/spec.md
     ✓ design.md
     ✓ tasks.md
     Ready for implementation!

You: /opsx:apply

AI:  Implementing add-dark-mode (spec-driven schema)
     Working on task 1.1: Create ThemeContext...
     ✓ Task 1.1 complete
     Working on task 1.2: Add CSS custom properties...
     ✓ Task 1.2 complete
     ...
     All 8 tasks complete!

You: /opsx:archive

AI:  Synced specs to openspec/specs/ui/spec.md
     Archived to openspec/changes/archive/2025-01-24-add-dark-mode/
     Done.
```

## Expanded Workflow: Step by Step

For incremental artifact creation and review at each step.

### 1. Optionally explore first

```
You: /opsx:explore how should we handle rate limiting?

AI:  [investigates codebase, draws diagram, compares options]
     
     RATE LIMITING OPTIONS
     ────────────────────────────────────────
     Middleware      Redis-backed      Token bucket
     simple ✓        scalable ✓        fair ✓
     per-endpoint    shared state      per-user
     no deps ✓       needs Redis       complex

     Your stack (Express, no Redis) points toward middleware.
     Ready to start a change for this?

You: Yes, let's do middleware-based rate limiting.
```

### 2. Create the change scaffold

```bash
# CLI
openspec new change add-rate-limiting
```

Or via AI:
```
You: /opsx:new add-rate-limiting

AI:  Created openspec/changes/add-rate-limiting/
     Schema: spec-driven
     Artifact status:
       [ready] proposal
       [blocked] specs (needs: proposal)
       [blocked] design (needs: proposal)
       [blocked] tasks (needs: specs, design)
```

### 3. Create artifacts one at a time

```
You: /opsx:continue

AI:  Creating proposal.md...
     [writes proposal based on conversation context]
     ✓ Created openspec/changes/add-rate-limiting/proposal.md

     Now available: specs, design
     Run /opsx:continue for the next artifact.

You: /opsx:continue

AI:  Creating specs/rate-limiting/spec.md...
     [reads proposal.md, creates delta spec]
     ✓ Created openspec/changes/add-rate-limiting/specs/rate-limiting/spec.md

     Now available: design, tasks (once design is done)

You: /opsx:continue

AI:  Creating design.md...
     ✓ Created openspec/changes/add-rate-limiting/design.md

You: /opsx:continue

AI:  Creating tasks.md...
     ✓ Created openspec/changes/add-rate-limiting/tasks.md
     All planning artifacts complete! Ready for /opsx:apply.
```

Or skip to fast-forward:

```
You: /opsx:ff add-rate-limiting

AI:  Fast-forwarding add-rate-limiting...
     ✓ proposal.md
     ✓ specs/rate-limiting/spec.md
     ✓ design.md
     ✓ tasks.md
     All artifacts created! Ready for implementation.
```

### 4. Check status at any time

```bash
openspec status --change add-rate-limiting
openspec status --change add-rate-limiting --json
```

```bash
openspec list              # list all active changes
openspec show add-rate-limiting
openspec view              # interactive dashboard
```

### 5. Implement

```
You: /opsx:apply add-rate-limiting

AI:  Implementing add-rate-limiting (spec-driven)
     Reading context: proposal.md, specs/rate-limiting/spec.md, design.md, tasks.md

     Progress: 0/6 tasks complete

     Working on task 1.1: Add rate-limiting middleware...
     [creates src/middleware/rateLimiting.ts]
     ✓ Task 1.1 complete

     Working on task 1.2: Configure per-route limits...
     ...
     All 6 tasks complete!
```

If something unexpected comes up mid-implementation:

```
AI:  ## Implementation Paused

     Progress: 3/6 tasks complete

     Issue Encountered: The design calls for in-memory storage, but the
     test environment uses multiple workers, so in-memory state isn't
     shared. This needs a design decision.

     Options:
     1. Switch to Redis (add dependency)
     2. Disable rate limiting in test environment
     3. Use a singleton store with shared memory

     What would you like to do?
```

You can update `design.md` with the decision and then continue:

```
You: Update design.md to use option 2 and continue.

AI:  Updated design.md. Continuing...
     Working on task 3.2: ...
```

### 6. Verify before archiving (optional but recommended)

```
You: /opsx:verify

AI:  Verifying add-rate-limiting...

     COMPLETENESS
     ✓ All 6 tasks checked
     ✓ Rate Limiting requirement has corresponding code (src/middleware/rateLimiting.ts)
     ⚠ Scenario "Burst limit exceeded" has no test coverage

     CORRECTNESS
     ✓ Implementation matches spec intent
     ⚠ Design mentions "configurable per-route limits" but implementation uses hardcoded values

     COHERENCE
     ✓ Design decisions reflected in code structure

     SUMMARY
     Critical: 0   Warnings: 2   Suggestions: 0
     Ready to archive (with warnings).

     Recommendations:
     1. Add test for burst limit scenario
     2. Make rate limits configurable via env vars or config, or update design.md
```

### 7. Archive

```
You: /opsx:archive

AI:  Archiving add-rate-limiting...

     Artifact status: All 4 artifacts complete
     Task status: 6/6 complete

     Delta specs found at openspec/changes/add-rate-limiting/specs/rate-limiting/spec.md
     Changes to sync:
       + Added requirement: Rate Limiting (2 scenarios)

     Sync now (recommended)?

You: Yes

AI:  ✓ Synced: openspec/specs/rate-limiting/spec.md (new file created)
     ✓ Archived to openspec/changes/archive/2025-05-13-add-rate-limiting/
     Done.
```

## Parallel Changes

Work on multiple changes simultaneously. Each has its own folder and can be applied independently.

```bash
# Start two changes
openspec new change add-dark-mode
openspec new change fix-login-redirect
```

```
You: /opsx:ff fix-login-redirect
     [fast-forwards artifacts for the bug fix]

You: /opsx:apply fix-login-redirect
     [implements the fix]

You: /opsx:archive fix-login-redirect
     [archives immediately]

# Back to the feature
You: /opsx:apply add-dark-mode
     [picks up where dark mode left off]
```

When you have multiple completed changes:

```
You: /opsx:bulk-archive

AI:  Found 3 active changes:
     - add-dark-mode (8/8 tasks)
     - add-rate-limiting (6/6 tasks)
     - update-footer (2/2 tasks)

     Checking for spec conflicts...
     ⚠ add-dark-mode and update-footer both touch specs/ui/

     Investigating codebase...
     Both changes are implemented. Will apply specs in chronological order:
     1. add-dark-mode (created Jan 20)
     2. update-footer (created Jan 22)

     Archive all 3 changes?

You: Yes

AI:  ✓ Archived add-dark-mode → archive/2025-05-13-add-dark-mode/
     ✓ Archived add-rate-limiting → archive/2025-05-13-add-rate-limiting/
     ✓ Archived update-footer → archive/2025-05-13-update-footer/

     Spec sync: 3 delta specs synced, 1 conflict resolved (ui: applied both in order)
```

## Handling an Existing Codebase (Brownfield)

For an existing project with no specs yet:

1. Run `openspec init` to initialize.
2. Start working with changes immediately — you don't need to write specs for existing behavior first.
3. Use delta specs to document what your changes ADD/MODIFY/REMOVE relative to existing behavior.
4. Over time, `openspec/specs/` grows as changes are archived, building a progressive specification.

Or, write initial specs for existing behavior manually in `openspec/specs/<capability>/spec.md` using the full spec format (not delta format — no `## ADDED` sections needed for initial specs).

## Useful CLI One-Liners

```bash
# See all active changes
openspec list

# Check status of a specific change
openspec status --change add-dark-mode --json

# Validate everything (for CI)
openspec validate --all --json

# Get enriched instructions for the next artifact (for scripting)
openspec instructions proposal --change add-dark-mode --json

# List available schemas
openspec schemas --json

# View interactive dashboard
openspec view

# Archive with no prompts (CI)
openspec archive add-dark-mode --yes

# Archive without touching specs (for infra/tooling changes)
openspec archive add-ci-config --skip-specs --yes
```

## When to Update vs Start a New Change

Update the existing change when:
- Same intent, refined execution (discovered edge cases, approach tweaks)
- Scope narrows (shipping MVP first, rest later)
- Learning-driven corrections (codebase isn't what you thought)

Start a new change when:
- Intent fundamentally changed
- Scope exploded to essentially different work
- Original change can be marked "done" as a standalone unit

The heuristics from the OpenSpec docs:
- Is this the same problem? → Update
- >50% scope overlap? → Update
- Can the original be "done" without these changes? → New change
