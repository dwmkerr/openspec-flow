## Context

The reusable workflow at `.github/workflows/openspec-flow.yml` already
accepts two alternative credentials for the Claude agent:

```yaml
secrets:
  ANTHROPIC_API_KEY:        { required: false }
  CLAUDE_CODE_OAUTH_TOKEN:  { required: false }
```

`openspec-flow-run-agent` (the composite action) forwards whichever is
populated. Either one alone is sufficient for the agent to authenticate.

Documentation lags the workflow. `README.md` shows only the
`ANTHROPIC_API_KEY` line in the shim snippet, and neither `README.md`
nor `docs/architecture.md` tells a first-time user:

- where to mint an Anthropic API key (console URL)
- where to register a secret in their target repo (Settings →
  Secrets and variables → Actions → New repository secret)
- that `CLAUDE_CODE_OAUTH_TOKEN` is an accepted drop-in
- how to verify the credential is wired correctly
- what error surface to expect if the secret is missing or wrong

Result: shim installers get a runner failure with no obvious next step.

## Goals / Non-Goals

**Goals:**
- A new user copying the Mode A snippet can configure the Anthropic
  credential end-to-end without leaving the README.
- The architecture doc carries the deeper reference (precedence,
  troubleshooting) so the README stays short.
- The spec captures the documentation contract so future changes to
  credential handling are forced to update the docs too.

**Non-Goals:**
- No workflow YAML changes. The two-credential surface already exists.
- No new composite-action inputs. No env-var aliasing.
- No support for additional credential types (e.g. Bedrock, Vertex)
  even though `claude-code-action` accepts them — out of scope for this
  issue.
- No automated preflight check that the secret is present. That is a
  separate follow-up if it materialises.

## Decisions

**Document both credentials, recommend the API key.** API keys are the
default flow in Anthropic's console and require no extra coordination.
The OAuth token path exists for users already running
`claude-code-action` with a Claude.ai Pro/Max subscription. We mention
both, with the API key as the primary path.

Alternatives considered: documenting only the API key. Rejected because
the workflow accepts both, and users who already use the OAuth path
will assume it works (it does) but hit an error if the README appears
to mandate `ANTHROPIC_API_KEY`.

**Add credential setup to README, not just architecture.** README is
the first surface a shim installer reads. Burying it in architecture
guarantees support friction. Keep README short by linking to the deeper
architecture section for troubleshooting.

**Put the troubleshooting block in architecture, not README.** README
stays a quick-start. Architecture already owns the auth-surfaces table
(lines 102–110) — extend it rather than duplicate.

**Encode the documentation contract as a spec requirement.** Without a
spec hook, the docs drift the next time the credential surface changes.
The requirement says "documentation MUST explain how to provide the
Anthropic credential" so future credential changes block on doc
updates.

## Risks / Trade-offs

- **Risk**: README grows past the one-screen mental model. → Mitigation:
  fold the credential block into the existing Mode A subsection (~6
  lines of prose + one inline command), link out for depth.
- **Risk**: Anthropic console URL changes. → Mitigation: link to the
  stable `console.anthropic.com/settings/keys` landing page only, not a
  deep link.
- **Risk**: Users mix both secrets and wonder which wins. → Mitigation:
  document precedence explicitly in architecture (`ANTHROPIC_API_KEY`
  takes precedence in `claude-code-action` when both are set; we mirror
  that behaviour because we pass both through).

## Migration Plan

Documentation-only change. No migration. Ships with the impl PR; users
see the new section on next README read.

## Open Questions

None — the workflow's credential surface is settled; this is purely
documenting it.
