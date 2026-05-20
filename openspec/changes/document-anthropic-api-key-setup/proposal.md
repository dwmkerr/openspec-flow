## Why

Operators installing openspec-flow via the reusable-workflow shim (Mode A)
do not get a clear, single-source-of-truth answer to the question "where
do I put my Anthropic API key?". Today, the answer is spread across the
README install snippet, `docs/architecture.md`, `.env.example` (which is
actually for App-mode dev), and a comment inside
`.github/workflows/openspec-flow.yml`. New installers hit the workflow,
get an authentication failure from the agent step, and have to grep the
repo to figure out which secret name to add and where to add it.

The fix is documentation-only: capture the shim-mode API key contract in
one place so installers can follow it end-to-end without reading source.

## What Changes

- Add a dedicated **"Configure the Anthropic API key"** section to the
  README that, for shim-mode (Mode A) installs, lists:
  1. Where to obtain an API key (`console.anthropic.com`).
  2. The exact GitHub UI path to add it
     (Settings → Secrets and variables → Actions → New repository secret).
  3. The required secret name (`ANTHROPIC_API_KEY`) and the optional
     OAuth alternative (`CLAUDE_CODE_OAUTH_TOKEN`).
  4. How the shim forwards the secret into the reusable workflow.
  5. How to verify the secret is wired (re-run a labelled issue; check
     the agent step log for "API key not set" / 401 errors).
- Add the same content as a short "Configuring secrets" subsection in
  `docs/architecture.md` under "Mode A — Action install", cross-linked
  from the README.
- Update the README's existing install snippet to reference the new
  section by anchor link rather than burying the secret list inline.
- Clarify in `.env.example` that `ANTHROPIC_API_KEY` there is for local
  Probot-mode dev, **not** for shim-mode installs (which put it in
  repo Actions secrets).

No code, workflow, or runtime behaviour changes. The workflow already
accepts the secret correctly via `secrets.ANTHROPIC_API_KEY` and the
optional `secrets.CLAUDE_CODE_OAUTH_TOKEN` alternative; this change
just makes the install path discoverable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-flow`: add a documentation requirement covering shim-mode
  Anthropic API key configuration. The requirement is about the
  install-facing docs that ship from this repo (README + architecture
  doc), not about the workflow file's runtime behaviour.

## Impact

- Affected files:
  - `README.md` — new section, anchor link from install snippet.
  - `docs/architecture.md` — new "Configuring secrets" subsection under
    Mode A.
  - `.env.example` — clarifying comment on `ANTHROPIC_API_KEY`.
  - `openspec/specs/openspec-flow/spec.md` — adds one requirement and
    scenarios via the change's delta.
- No code, no workflow, no dependencies, no API surface.
- Risk: low. Pure documentation; no runtime change. Worst case is a
  doc inconsistency caught by review.
