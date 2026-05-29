## Why

Shim-mode (Action) e2e reached the `create-spec` handler then failed: `openspec CLI not found on PATH`. The reusable workflow checks out + builds openspec-flow and provides `ANTHROPIC_API_KEY`, but never installs the Fission `openspec` CLI that handlers shell out to (`openspec new change`, `openspec validate`, `openspec archive`). In dev/Probot the CLI is on the host PATH; on a fresh Action runner it is absent.

The `openspec` CLI is a binary installed on the runner — distinct from the openspec **skills** (`.claude/skills/openspec-*`), which the handler reads from the cloned target repo (committed there by `openspec init --tools claude`).

## What Changes

- Reusable workflow installs the openspec CLI (`npm i -g @fission-ai/openspec`) after build, before dispatch.
- Fix the precondition error message scope typo: `@fishtail-ai/openspec` → `@fission-ai/openspec`.

## Capabilities

### Modified Capabilities

- `action-dispatch`: the reusable-workflow requirement gains an explicit step provisioning the openspec CLI on the runner.

## Impact

- **Affected code**: `.github/workflows/openspec-flow.yml` (install step), `src/handlers/create-spec/preconditions.ts` (message fix).
- **Runtime**: each Action run installs the openspec CLI globally (~few seconds). Version pinning is a follow-up (ideas.md).
- **No** change to App/Probot mode (CLI already on the dev host).
