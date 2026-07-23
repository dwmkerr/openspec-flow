# composite-action-env-passthrough

## Why

The agent's Anthropic configuration is fixed. The reusable workflow threads exactly one credential — `ANTHROPIC_API_KEY` — into the runner, and nothing else. Any consumer that needs a different endpoint (a corporate LLM gateway instead of `api.anthropic.com`), a bearer token instead of an API key, custom headers, or a model override has no way to supply it without patching openspec-flow itself.

The immediate driver is a consumer (a corporate monorepo) that must route agent traffic through an internal Anthropic gateway rather than a personal API key. The gateway needs a different `ANTHROPIC_BASE_URL` and a gateway-issued token. Today that requires a new declared secret per option, forwarded per option — the plumbing grows one line for every knob Anthropic exposes.

The official `anthropics/claude-code-action` already solved this. It is a **composite action** and forwards config from the caller's ambient job env (`${{ env.ANTHROPIC_BASE_URL }}`, `ANTHROPIC_CUSTOM_HEADERS`, model overrides, provider base URLs) plus open-ended escape hatches (`settings`, `claude_args`). A composite action inherits the caller's job env for free; a reusable workflow does not — env never crosses the `workflow_call` boundary. openspec-flow is a reusable workflow, which is exactly why it cannot pass config through today.

## What Changes

- **New**: root `action.yml` — a composite action that owns the agent pipeline (checkout → setup Node → build → install OpenSpec CLI → **mint App token** → dispatch). It inherits the caller's job env, so any `ANTHROPIC_*` / `CLAUDE_*` variable the caller sets reaches the Agent SDK with no per-variable plumbing. Credentials (`anthropic_api_key`, `claude_code_oauth_token`) and the App-identity inputs are declared `inputs`; config knobs pass through ambient env.
- **Modified**: the App token-mint steps (OIDC broker + legacy App-secret + `GITHUB_TOKEN` fallback) move **into** the composite action so composite-direct consumers keep App identity without hand-wiring OIDC.
- **Modified**: `.github/workflows/openspec-flow.yml` becomes a thin reusable-workflow wrapper that `uses: ./` the composite action, preserving today's drop-in path. It accepts either `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` as an optional workflow secret and forwards both declared credential inputs. It continues to own `on: workflow_call`, job `permissions`, and the runner.
- **Modified**: `src/agent/run.ts` accepts `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, or `ANTHROPIC_AUTH_TOKEN` (bearer-style gateways use the latter). The guard fails only when all three are absent. No routing code is needed — the SDK reads the credential and related vars from `process.env` directly.
- **New**: `docs/advanced-configuration.md` documents the two consumption modes — (1) the reusable-workflow shim (simple, no per-repo config), (2) composite-direct (own the job, set `env:` for gateway base URL, bearer token, custom headers, model overrides). Includes a worked corporate-gateway example.
- **Out of scope**: a declared `agent_env` input on the *reusable workflow* (would let shim users configure without graduating to composite-direct). Not needed for the driving use case; consumers that need advanced config use composite-direct. Tracked as a follow-up if demand appears.

## Capabilities

### New Capabilities

- `composite-action`: a root `action.yml` composite that runs the full agent pipeline in the caller's job and inherits the caller's job env, so Anthropic configuration (base URL, auth token, custom headers, model overrides) passes through with no per-variable declaration. Owns App-token minting so composite-direct callers keep App identity.

### Modified Capabilities

- `openspec-flow`: the reusable workflow is refactored into a thin wrapper that delegates the pipeline to the composite action while continuing to own triggers, permissions, and the runner. The token-mint priority chain moves into the composite; behavior is unchanged for drop-in consumers.
- `agent-runtime`: the agent run guard accepts `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`, or `ANTHROPIC_AUTH_TOKEN`. The Agent SDK's native reading of `ANTHROPIC_BASE_URL` and related env vars is now a documented, supported configuration surface.

## Impact

- New file: root `action.yml` (composite).
- `.github/workflows/openspec-flow.yml`: refactored to `uses: ./` the composite; token-mint steps relocated into the composite.
- `templates/openspec-flow.yml`: forwards both optional Claude credential secrets to the reusable workflow.
- `src/agent/run.ts`: guard accepts any of the three supported credential env vars.
- `src/install/*`, `src/app-install/*`: secret-presence check updated to accept `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` (cosmetic; advisory output only).
- New file: `docs/advanced-configuration.md`.
- No runtime dependency changes.
