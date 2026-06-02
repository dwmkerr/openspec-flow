## 1. Implement

- [x] 1.1 `resolveRemote(cwd)` in `src/install/detect.ts` — parse cwd's `origin` URL (https + ssh), return `owner/name` or null
- [x] 1.2 `renderReadmeBlock(remote?)` + `renderMinimalReadme(name, remote?)` prepend a badge line when remote is supplied
- [x] 1.3 `plan.ts` resolves remote once and passes through both render calls

## 2. Verification

- [x] 2.1 `npm run build` clean
- [x] 2.2 Smoke (real remote): badge URL points at the resolved repo
- [x] 2.3 Smoke (no remote): badge omitted, rest unchanged
- [x] 2.4 `openspec validate install-readme-badge` clean

## 3. Archive

- [x] 3.1 `openspec archive install-readme-badge --yes`
