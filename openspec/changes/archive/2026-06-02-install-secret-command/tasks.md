## 1. Implement

- [x] 1.1 `renderSecretCommands(secrets)` in `src/install/index.ts` — prints `gh secret set ANTHROPIC_API_KEY  # Setup Anthropic key` when missing/unknown; omits when present
- [x] 1.2 Wire into both the no-op-return path and the post-apply output
- [x] 1.3 Trim `renderNextSteps` to drop the redundant "ensure ANTHROPIC_API_KEY is set" line

## 2. Verification

- [x] 2.1 `npm run build` clean
- [x] 2.2 Smoke (missing/skipped repo): command printed
- [x] 2.3 Smoke (real repo with secret set): command omitted
- [x] 2.4 `openspec validate install-secret-command` clean

## 3. Archive

- [x] 3.1 `openspec archive install-secret-command --yes`
