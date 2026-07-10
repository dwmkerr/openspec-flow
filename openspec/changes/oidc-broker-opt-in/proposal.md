# oidc-broker-opt-in

## Why

The reusable workflow defaults `broker_url` to `https://openspec-flow.fly.dev`, so every shim that does not set it silently opts into the public broker. The broker only mints tokens for repos where the openspec-flow App is installed; on any other repo the broker step hard-fails (`exit 1`) instead of falling back to `GITHUB_TOKEN`. The only workaround is to set `broker_url: ''` — blanking a URL to opt out of a thing you never knowingly opted into. The name `broker_url` also describes the transport, not the intent (which bot identity you run as).

Separately, the generated shim pins `@main` (`DEFAULT_REF` was never updated after the first release), so installs track a moving branch instead of a released version.

## What Changes

- **Broker becomes opt-in.** The reusable workflow's `oidc_broker_url` default changes from `https://openspec-flow.fly.dev` to `''`. With no broker URL set (and no `OPENSPEC_FLOW_BROKER_URL` variable), the broker step is skipped and the flow runs as github-actions[bot]. App-installed repos are unaffected — `app-install` bakes the broker URL into their shim, overriding the default. The `broker_url: ''` workaround is no longer needed.
- **Rename for intent.** The workflow inputs `broker_url` / `broker_audience` become `oidc_broker_url` / `oidc_broker_audience` (reusable workflow, composite action, and the key the shim renderer emits). Descriptions explain the OIDC exchange and that the URL selects a broker *deployment* — the OIDC provider is always GitHub Actions.
- **Clearer failure.** When the broker is opted-in but returns no token, the error names the repo, links the App install, and points at unsetting the broker to run as github-actions[bot], instead of a raw `exit 1`.
- **Version-pinned shim.** `install` pins the generated shim to `@v<package-version>` instead of `@main`.
- **Docs.** README and `docs/advanced-configuration.md` gain an "Identity" section: github-actions[bot] by default, openspec-flow[bot] via the broker or App secrets, plus self-hosting the broker.

## Capabilities

### Modified Capabilities

- `openspec-flow`: the reusable workflow's broker input is renamed and defaults to empty, making App identity opt-in rather than the implicit default.
- `composite-action`: the broker input is renamed; the broker step runs only when a broker URL is set, and its failure message is actionable.
- `install`: the generated shim pins the release version and emits `oidc_broker_url` (not `broker_url`); the shim carries an identity comment.

## Impact

- `.github/workflows/openspec-flow.yml`: input rename + default flip + pass-through.
- `action.yml`: input rename + broker gate/env + error message.
- `src/install/templates.ts`, `plan.ts`, `index.ts`, `cli.ts`: emit `oidc_broker_url`, thread a `ref` so the shim pins `@v<version>`.
- `templates/openspec-flow.yml`: identity comment.
- `docs/advanced-configuration.md`, `README.md`: Identity section.
- Tests updated for the renamed key.
- Not in scope: renaming the `OPENSPEC_FLOW_BROKER_URL` / `OPENSPEC_FLOW_BROKER_AUDIENCE` variable + broker-host env (ops surface, renaming breaks existing installs); pinning the App-init (remote) shim's ref.
