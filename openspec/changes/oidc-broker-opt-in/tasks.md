# Tasks: oidc-broker-opt-in

## 1. Broker opt-in + rename

- [x] 1.1 Reusable workflow: rename `broker_url`→`oidc_broker_url`, `broker_audience`→`oidc_broker_audience`; default `oidc_broker_url` to `''`; why-bearing descriptions; pass renamed inputs to the composite.
- [x] 1.2 Composite action: rename the same inputs; broker `if:`/env reference `inputs.oidc_broker_url`; default `''`.
- [x] 1.3 Composite broker step: replace the raw `exit 1` with an actionable message (repo, App install link, opt-out).

## 2. Shim rendering

- [x] 2.1 `templates.ts`: emit `oidc_broker_url` / `oidc_broker_audience` keys.
- [x] 2.2 Thread a `ref` through `cli install` → `runInstall` → `plan` → `renderWorkflow`; CLI passes `v<package-version>` so the shim pins the release.
- [x] 2.3 `templates/openspec-flow.yml`: identity comment (github-actions[bot] default; how to get openspec-flow[bot]).

## 3. Docs

- [x] 3.1 `docs/advanced-configuration.md`: rename examples; add Identity section (default vs App identity, self-hosting the broker, OIDC provider is always GitHub).
- [x] 3.2 `README.md`: Identity section.

## 4. Tests + gates

- [x] 4.1 Update `templates.test.ts` for the renamed key.
- [x] 4.2 typecheck + full test suite + build green.

## 5. Verification (runtime — ark E2E)

- [ ] 5.1 Plain shim (no App, no broker): dispatches as github-actions[bot], no broker failure.
- [ ] 5.2 Shim with `oidc_broker_url` set + App installed: mints App token.
