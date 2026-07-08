# Design: composite-action-env-passthrough

## Problem

The reusable workflow is the only packaging openspec-flow ships. It forwards exactly one Anthropic credential and no configuration. Consumers that need a non-default endpoint, bearer auth, custom headers, or model overrides cannot supply them without editing openspec-flow, because **env does not cross the `workflow_call` boundary** — a caller's `env:` block is invisible to the reusable workflow it calls.

## Why a composite action

GitHub packaging primitives differ in exactly the dimension that matters here:

| | Reusable workflow (`workflow_call`) | Composite action |
| --- | --- | --- |
| Runs as | its own job | a step inside the caller's job |
| Sees caller's `env:` | **no** — only declared `inputs`/`secrets` cross | **yes** — inherits the caller's job env |
| Owns triggers / permissions / runner | yes | no (caller owns them) |
| Config surface | one declared input per option | any env var the caller sets, for free |

The official `anthropics/claude-code-action` is a composite action for precisely this reason. It declares `inputs` for credentials and structured auth, but forwards config from ambient env — `ANTHROPIC_BASE_URL`, `ANTHROPIC_CUSTOM_HEADERS`, `ANTHROPIC_DEFAULT_{SONNET,HAIKU,OPUS}_MODEL`, provider base URLs — and offers `settings` / `claude_args` as open-ended escape hatches.

Porting that model dissolves the "one input per knob" problem: once the pipeline runs in the caller's job, every env var the caller sets is visible to the Agent SDK with zero openspec-flow plumbing.

## Keep the reusable workflow as a wrapper

A composite action pushes triggers, `permissions`, and the runner onto the caller. That is the right trade for advanced consumers, but it breaks the drop-in onboarding the app relies on (label an issue → app PRs one small file → done).

Resolution — ship both, layered:

```
action.yml                          composite "engine":
                                      checkout → setup → build → install
                                      → mint App token → dispatch
                                      inherits caller job env (config passthrough)

.github/workflows/openspec-flow.yml thin reusable wrapper:
                                      owns on: workflow_call, permissions, runner
                                      uses: ./ (the composite)

templates/openspec-flow.yml         drop-in shim (unchanged):
                                      uses: <repo>/.github/workflows/openspec-flow.yml@<ref>
```

The engine logic lives in exactly one place. The reusable workflow shrinks to trigger/permission ownership plus a `uses: ./` step.

## Consumption modes

Three consumers, two mechanisms:

1. **App-driven** — the app PRs the shim into the target repo. Reusable-workflow path.
2. **Manual shim** — the consumer copies the shim themselves. Reusable-workflow path.
3. **Composite-direct** — the consumer authors their own job, `uses: <repo>@<ref>` (the composite), and sets `env:` for advanced config. This is the only path that gets env passthrough.

Modes 1 and 2 are identical machinery. Mode 3 is the graduation path: a consumer that outgrows the shim does not *edit* the shim (editing its job `env:` is inert across `workflow_call`) — they **replace** it with a composite-direct job. The docs must state this explicitly, because "set env on the shim" is the intuitive-but-wrong move.

## Token minting moves into the composite

The reusable workflow currently owns the OIDC-broker mint, the legacy App-secret mint, and the `GITHUB_TOKEN` fallback. If a composite-direct consumer bypasses the reusable workflow, they would lose App identity unless they re-implement OIDC by hand.

So the mint steps move into the composite action, parameterized by inputs (`app_id`, `private_key`, `broker_url` or their env/var equivalents). The reusable wrapper passes its resolved values through. The priority chain (broker → legacy secrets → `GITHUB_TOKEN`) is preserved exactly; only its location changes. This keeps the change non-functional for drop-in consumers while making App identity available to composite-direct consumers.

`id-token: write` remains a caller-owned permission in both modes (a composite action cannot grant job permissions).

## Credential guard

`src/agent/run.ts` currently hard-fails unless `ANTHROPIC_API_KEY` is set. Gateways that authenticate with a bearer token use the SDK's `ANTHROPIC_AUTH_TOKEN` (Authorization header) rather than `ANTHROPIC_API_KEY` (`x-api-key` header). The guard becomes: fail only when **both** are absent. No routing logic is added — the SDK reads whichever is present, plus `ANTHROPIC_BASE_URL`, from `process.env`.

## Why not a JSON `agent_env` input instead

A declared `agent_env` JSON input on the reusable workflow (merged into `process.env`, allowlisted to `ANTHROPIC_*`/`CLAUDE_*`) would let shim users configure without graduating to composite-direct. It is strictly more plumbing than the composite approach and duplicates a mechanism the platform already provides (job env inheritance). Deferred: composite-direct covers the driving use case. Revisit only if shim users need advanced config without owning a job.

## Risks

- **Caller must own `permissions` + `id-token: write` in composite-direct mode.** Missing `id-token: write` silently falls back to the legacy/`GITHUB_TOKEN` path. Documented, and detectable in the run log.
- **Ambient env passthrough is implicit.** A composite-direct caller that sets a stray `ANTHROPIC_*` var changes agent behavior. Acceptable — mirrors the official action; the surface is the SDK's own documented env contract.
- **Refactor must preserve the mint priority chain exactly.** Covered by keeping the existing `if:` gating semantics when relocating the steps; verified against the drop-in path in testing.
