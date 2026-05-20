## Why

Users who copy the shim workflow into their repo (Mode A) have no clear
instructions on how to provide the Anthropic credential the agent needs
to run. The workflow references `secrets.ANTHROPIC_API_KEY` (and the
optional `secrets.CLAUDE_CODE_OAUTH_TOKEN` alternative), but `README.md`
and `docs/architecture.md` only show the `secrets:` block — they never
explain where to create the secret, that an OAuth token is an accepted
alternative, what scope is needed, or how to verify it once set. New
users hit a silent failure or a cryptic Anthropic auth error on their
first run.

## What Changes

- Add an "Anthropic credential" section to `README.md` covering the two
  supported credentials (`ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`),
  where to create them, and the GitHub UI path to register them as repo
  or organisation Actions secrets.
- Add the same content (deeper, with troubleshooting) to
  `docs/architecture.md` under Mode A so the shim-install path is fully
  documented end to end.
- Update the existing snippet in `README.md` to surface the OAuth token
  as a valid drop-in (matching what the reusable workflow already
  accepts).
- No code changes. The workflow already supports both credentials —
  this change closes the documentation gap.

## Capabilities

### New Capabilities

_None — this is a documentation-only change against an existing
capability._

### Modified Capabilities

- `openspec-flow`: add a requirement that the shim-install
  documentation MUST explain how to provide the Anthropic credential
  (`ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`) and where to set it
  in GitHub.

## Impact

- `README.md` — new "Configure the Anthropic credential" subsection
  under "Mode A".
- `docs/architecture.md` — expanded Mode A walkthrough including secret
  creation, credential precedence, and a troubleshooting note for the
  common auth failure.
- `openspec/specs/openspec-flow/spec.md` — gains one requirement (via
  the delta in this change) ensuring the docs stay in sync.
- No runtime, workflow YAML, or composite-action changes. No new
  dependencies.
