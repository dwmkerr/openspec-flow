# Advanced configuration

openspec-flow ships as both a reusable workflow and an action. The reusable workflow is the drop-in path: the App writes a shim that calls it, and there is nothing to configure. The action gives you more control. You call it from your own job, so you can set anything the job allows, including `env`. That is how you point the agent at a different Anthropic endpoint, such as an AI gateway.

Most repos want the reusable workflow. Reach for the action when you need to change how the agent talks to Anthropic.

## Start from the shim

The shim that `openspec-flow init` writes (or that the App opens a PR for) is a normal workflow file. Use it as a starting point and edit it. To add configuration, change the job so it calls the action directly:

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
  id-token: write

jobs:
  flow:
    runs-on: ubuntu-latest
    steps:
      - uses: dwmkerr/openspec-flow@<ref>
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          # For openspec-flow[bot] identity add: oidc_broker_url: https://openspec-flow.fly.dev
```

This behaves the same as the reusable workflow (runs as github-actions[bot]). It is just written out so you can add to it — see Identity below to run as openspec-flow[bot].

## Example: route through an AI gateway

Set the endpoint and credential in `env`. The action forwards them to the agent:

```yaml
jobs:
  flow:
    runs-on: ubuntu-latest
    env:
      ANTHROPIC_BASE_URL: https://gateway.internal.example.com/anthropic
      ANTHROPIC_AUTH_TOKEN: ${{ secrets.GATEWAY_TOKEN }}
    steps:
      - uses: dwmkerr/openspec-flow@<ref>
```

The agent runs with either `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`, so a gateway that uses a bearer token needs no API key.

Anything you set in the job `env` reaches the agent, not just these keys. The action's steps run in your job and share its environment, so any variable the Agent SDK understands works the same way: `ANTHROPIC_BASE_URL`, `ANTHROPIC_CUSTOM_HEADERS`, model overrides, timeouts, and so on.

One thing to know: this only works when the job calls the action directly. The reusable workflow runs as its own job and does not share your `env`, so setting `env` on a shim that still calls the reusable workflow has no effect. Calling the action, as above, is what makes it work.

## Inputs

| Input | Purpose |
| --- | --- |
| `anthropic_api_key` | Anthropic API key. Optional if you supply a credential through `env`. |
| `claude_code_oauth_token` | Claude Code subscription token, an alternative to the API key. |
| `github_token` | Token used when no App identity is minted. Defaults to the job `GITHUB_TOKEN`. |
| `app_id`, `private_key` | GitHub App identity for the secret-based path (see below). |
| `oidc_broker_url`, `oidc_broker_audience` | OIDC token broker settings (see Identity below). Empty by default. The `OPENSPEC_FLOW_BROKER_URL` repo or org variable overrides `oidc_broker_url`. |

## Identity

By default openspec-flow runs as **github-actions[bot]** using the job's `GITHUB_TOKEN`. That is enough to try it out, but `GITHUB_TOKEN` cannot push changes under `.github/workflows/`, and its pushes do not trigger downstream workflows.

For **openspec-flow[bot]** identity, give the flow an App token. Two ways:

- **Broker (recommended).** Set `oidc_broker_url` (or the `OPENSPEC_FLOW_BROKER_URL` variable). The runner exchanges its GitHub OIDC token for a short-lived App token through the broker — no App private key in your repo. Needs `id-token: write` on the job. Run your own broker deployment and point `oidc_broker_url` at it to keep token minting on infrastructure you control; `oidc_broker_audience` sets the `aud` claim it expects.
- **Secrets.** Store the App id and private key as repo secrets (`OPENSPEC_FLOW_APP_ID`, `OPENSPEC_FLOW_PRIVATE_KEY`). The older path, kept as a fallback — the broker replaced it so you no longer distribute the private key.

The OIDC provider is always GitHub Actions; the broker only accepts the runner's GitHub-issued token. `oidc_broker_url` selects the broker deployment, not a different identity provider.
