## Why

`install` inserted the badge marker block **inside a fenced code block** in livedown's README. The H1 detector used a naive regex (`/^# .+$/m`) that matched a bash comment line (`# Clone the repo.`) inside a ```` ```bash ```` fence. Badge ended up mid-file, splitting the fence.

## What Changes

- `findFirstH1End` walks the README line by line tracking the in/out fence state (toggled by lines starting with ` ``` `). Only `# ` lines outside any fence count as the title anchor.
- Behaviour preserved: when a real H1 exists outside fences → badge inserted under it; when not (HTML-only titles, or README without H1) → badge prepended at the top.

## Capabilities

### Modified Capabilities

- `install`: clarify that the H1 anchor for badge placement is the first `# ` line **outside fenced code blocks**.

## Impact

- **Affected code**: `src/install/plan.ts` — new `findFirstH1End` helper replacing the regex match.
- **Compatibility**: existing badge markers preserved; users with a misplaced badge can revert the README and re-run.
