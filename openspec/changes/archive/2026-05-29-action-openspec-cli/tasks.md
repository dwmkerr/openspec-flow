## 1. Fix

- [x] 1.1 Reusable workflow: add `npm i -g @fission-ai/openspec` step after build, before dispatch
- [x] 1.2 Fix precondition message scope `@fishtail-ai` → `@fission-ai`

## 2. Verification

- [x] 2.1 `npm run typecheck` + `npm test` green
- [ ] 2.2 `openspec validate action-openspec-cli` clean
- [ ] 2.3 Re-run shim e2e on git-workforest: `openspec:go` → create-spec handler passes the CLI precondition

## 3. Archive

- [ ] 3.1 `openspec archive action-openspec-cli --yes`
