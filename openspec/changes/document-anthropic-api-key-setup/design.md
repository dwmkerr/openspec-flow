## Context

openspec-flow ships in two install modes (CLAUDE.md → "Install modes"):

- **Action / shim mode (Mode A)**: target repo drops
  `.github/workflows/openspec-flow.yml` that `uses:` this repo's reusable
  workflow. The shim forwards repo-level GitHub Actions secrets into the
  reusable workflow as `secrets.ANTHROPIC_API_KEY` (with
  `secrets.CLAUDE_CODE_OAUTH_TOKEN` as an alternative path).
- **App mode (Mode B)**: Probot service on Fly.io. Runtime config comes
  from `process.env.ANTHROPIC_API_KEY` per the `agent-runtime` spec.

Today, both code paths *work*. The runtime contract is unambiguous:
`.github/workflows/openspec-flow.yml` declares `ANTHROPIC_API_KEY` as
an optional input secret with a description; `src/agent/run.ts` reads
`process.env.ANTHROPIC_API_KEY`; `agent-runtime` spec requires fast
failure when missing.

The gap is documentation. A new operator following the README install
snippet sees:

```yaml
secrets:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  ...
```

…with one sentence under it ("Add three secrets …"). It does not say:

- where to obtain the key,
- which GitHub UI screen to add it on,
- that the secret name on the *right* of the colon must match what they
  store in repo secrets (the snippet uses the same name on both sides,
  which is convenient but obscures the distinction),
- how to verify the key is actually wired,
- which secret to use if they already have a Claude Code OAuth token.

`docs/architecture.md` has the same install snippet but no install
instructions either. `.env.example` lists `ANTHROPIC_API_KEY` but that
file is for local Probot dev — easy to mistake for the shim contract.

This change consolidates the shim-mode API key story into the README,
adds a short cross-linked subsection in `docs/architecture.md`, and
clarifies the `.env.example` comment so it doesn't get applied to the
wrong mode.

## Goals / Non-Goals

**Goals:**

- A new operator installing openspec-flow via shim mode can configure
  the Anthropic API key without reading source files.
- The README is the single source of truth for shim-mode secrets.
  Other docs link to it rather than duplicating instructions.
- The relationship between `ANTHROPIC_API_KEY` (required for shim mode)
  and `CLAUDE_CODE_OAUTH_TOKEN` (alternative) is explicit.
- A verification step lets the operator confirm the secret is wired
  before they file an "agent doesn't run" issue.

**Non-Goals:**

- Changing how the workflow consumes the secret. Runtime behaviour is
  unchanged.
- App-mode (Mode B) install docs. That path uses `.env` / host secret
  manager and is already covered by `docs/app-setup.md`. Out of scope
  here except for one disambiguating comment in `.env.example`.
- Documenting every secret the workflow accepts. Only the Anthropic
  key (and its OAuth alternative) are in scope. `OPENSPEC_FLOW_APP_ID`
  / `OPENSPEC_FLOW_PRIVATE_KEY` are a separate concern (App-token
  minting) and have their own treatment in `docs/architecture.md`.
- Automation that validates the secret at install time. Manual
  verification (re-trigger an issue, check the agent step log) is
  sufficient for the immediate problem.

## Decisions

**Decision 1: Put the canonical instructions in `README.md`, not a new
`docs/` page.**

Rationale: The README is what an operator sees first via the GitHub repo
landing page and is the only doc the install snippet already lives in.
A new `docs/install.md` would split the install story across two files
and create the same scatter the issue is trying to fix. The README
already has an Install section; the new content is a subsection of it.

Alternatives considered:
- New `docs/anthropic-api-key.md`: rejected — too narrow, isolates the
  one fact from its install context.
- `docs/install.md` covering both modes: rejected for this change —
  worth doing but bigger scope; this change stays focused on the issue.

**Decision 2: Add a short cross-link in `docs/architecture.md`, not a
duplicate.**

Architecture doc readers (developers maintaining openspec-flow) also
need to know the secret name, but they need it at the architectural
level ("Mode A consumes `ANTHROPIC_API_KEY`"), not the step-by-step
GitHub UI walkthrough. A one-paragraph subsection that names the secret
and links to the README section keeps the architecture doc focused on
design and avoids two places to update.

**Decision 3: Treat `CLAUDE_CODE_OAUTH_TOKEN` as a documented
alternative, not a parallel primary path.**

The workflow accepts either secret. `ANTHROPIC_API_KEY` is the obvious
default (everyone with a Claude API account has one; the OAuth token
requires `claude-code` to have been set up). Docs lead with the API
key, then mention the OAuth alternative in a single sentence with a
link to the Claude Code docs.

**Decision 4: `.env.example` gets a one-line clarifying comment, not a
rewrite.**

The file's purpose is local Probot dev. The minimal fix is one line
saying so above `ANTHROPIC_API_KEY=`, e.g. "For local Probot/App-mode
dev only. Shim-mode (GitHub Actions) installs put this in repo
Settings → Secrets and variables → Actions; see README."

**Decision 5: Verification is manual and lives in the README.**

Asking the operator to re-add `openspec:start` to a labelled issue and
check the agent step log for "API key not set" or HTTP 401 covers ~all
real misconfiguration cases. A workflow-side `if-no-key-then-comment`
preflight is a future change (would touch the workflow file and have
its own spec); keeping it out of scope here is consistent with the
"documentation-only" framing.

**Decision 6: Capability is `openspec-flow`, not a new
`install-docs`.**

The shim-mode install docs are inseparable from the workflow file they
explain — both ship from this repo and version together. Creating a
new capability for them would split the spec for one feature
artificially. Adding a requirement under `openspec-flow` keeps the
contract (workflow behaviour + the docs operators need to use it) in
one spec.

## Risks / Trade-offs

- **Docs drift**: If the workflow changes the secret name or adds a new
  required one, the README must be updated in the same change.
  Mitigation: the requirement scenarios pin the secret name; CI catches
  the regression at archive time when the delta is merged into the
  canonical spec.
- **README length**: Adding a subsection makes the README slightly
  longer. Acceptable — the install section is the most-read part of
  the README and benefits most from clarity.
- **`docs/architecture.md` cross-link rots**: If section anchors in the
  README change, the architecture doc link breaks. Mitigation: use a
  stable kebab-case heading (`## Configure the Anthropic API key`) and
  link by that heading slug.

## Migration Plan

None. Pure documentation change. Existing installs continue to work;
the docs simply describe what they already do. No rollback strategy
needed beyond reverting the PR.

## Open Questions

None. Issue body and the workflow file together fix the contract.
