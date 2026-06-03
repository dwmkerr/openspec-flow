## 1. Fix

- [x] 1.1 `findFirstH1End(content)` in `src/install/plan.ts` — walks lines, tracks ```` ``` ```` fence toggles, returns the end offset of the first `# ` line outside any fence
- [x] 1.2 `insertBadgeUnderTitle` uses it instead of `/^# .+$/m`

## 2. Verification

- [x] 2.1 `npm run build` clean
- [x] 2.2 Smoke (real markdown H1 + fence with `# comment`): badge under H1, fence untouched
- [x] 2.3 Smoke (HTML-only title): badge prepended at top
- [x] 2.4 Real repo (livedown): revert README + re-run → badge at top, no fence split
- [x] 2.5 `openspec validate badge-skip-code-fences` clean

## 3. Archive

- [x] 3.1 `openspec archive badge-skip-code-fences --yes`
