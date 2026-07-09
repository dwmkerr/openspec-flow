# Advanced configuration

openspec-flow ships two ways to consume it. Pick by how much control you need.

## Consumption modes

| Mode | How | Config surface |
| --- | --- | --- |
| **Reusable workflow** (drop-in) | The App PRs a shim, or you copy it. The shim `uses:` the reusable workflow. | Credentials + App identity only. No per-repo agent config. |
| **Composite action** (advanced) | Author your own job and `uses: dwmkerr/openspec-flow@<ref>`. | Anything you set in the job `env:` — gateway base URL, bearer token, custom headers, model overrides. |

Most repos want the reusable workflow — one file, nothing to tune. Reach for the composite action only when you need to change how the agent talks to Anthropic.

## Why the shim can't carry advanced config

The shim calls a **reusable workflow** (`uses: …/openspec-flow.yml@<ref>`). Environment does **not** cross the `workflow_call` boundary: a job `env:` you set in the shim is invisible to the reusable workflow it calls. Setting `env: ANTHROPIC_BASE_URL` on the shim does nothing.

A **composite action** runs as a step inside your job, so it inherits your job `env:`. That is the only path that gets configuration passthrough. To configure the agent you therefore **replace the shim with a composite-direct job** — you do not edit the shim.

## Composite-direct example: a corporate gateway

Route agent traffic through an internal Anthropic gateway instead of `api.anthropic.com`:

```yaml
name: openspec-flow
on:
  issues:
    types: [labeled]
  pull_request:
    types: [labeled, closed]
  pull_request_review_comment:
    types: [created]
  issue_comment:
    types: [created]

permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write        # required for the OIDC broker token path

jobs:
  flow:
    runs-on: ubuntu-latest
    env:
      # Config passthrough — the composite action forwards these to the Agent SDK.
      ANTHROPIC_BASE_URL: https://gateway.internal.example.com/anthropic
      ANTHROPIC_AUTH_TOKEN: ${{ secrets.GATEWAY_TOKEN }}   # bearer auth
      # ANTHROPIC_CUSTOM_HEADERS: "x-team: platform"       # optional
    steps:
      - uses: dwmkerr/openspec-flow@<ref>
        with:
          # No anthropic_api_key needed — the gateway authenticates via
          # ANTHROPIC_AUTH_TOKEN above. Provide App identity as usual:
          broker_url: https://openspec-flow.fly.dev
          # app_id / private_key: only for the legacy App-secret path
```

Notes:

- **Credentials.** The agent runs when either `ANTHROPIC_API_KEY` (x-api-key) or `ANTHROPIC_AUTH_TOKEN` (bearer) is present. Gateways typically use the bearer token.
- **`id-token: write` is yours to grant.** A composite action cannot grant job permissions. Without it, the OIDC broker path silently falls back to the legacy App-secret path or `GITHUB_TOKEN`.
- **Forwarded env is a curated allowlist**: `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_CUSTOM_HEADERS`. The whole job env is not forwarded.

## Action inputs

| Input | Purpose |
| --- | --- |
| `anthropic_api_key` | Anthropic API key (x-api-key). Optional if a credential is supplied via env. |
| `claude_code_oauth_token` | Claude Code subscription token, alternative to the API key. |
| `github_token` | Token used when no App identity is minted. Defaults to the job `GITHUB_TOKEN`. |
| `app_id` / `private_key` | GitHub App identity (legacy path). |
| `broker_url` / `broker_audience` | OIDC token broker settings. The `OPENSPEC_FLOW_BROKER_URL` repo/org variable overrides `broker_url`. |
