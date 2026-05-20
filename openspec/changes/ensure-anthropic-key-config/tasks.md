## 1. README — Mode A credential setup

- [ ] 1.1 Add a "Configure the Anthropic credential" subsection inside the
       Mode A section of `README.md`, naming both `ANTHROPIC_API_KEY`
       (primary) and `CLAUDE_CODE_OAUTH_TOKEN` (alternative), with the
       Anthropic console URL for API key creation.
- [ ] 1.2 In the same subsection, document the GitHub UI path
       `Settings → Secrets and variables → Actions → New repository
       secret` and call out organisation-level secrets as the
       multi-repo option.
- [ ] 1.3 Update the existing Mode A workflow snippet so the
       `CLAUDE_CODE_OAUTH_TOKEN` line is shown commented-out alongside
       `ANTHROPIC_API_KEY`, making the alternative discoverable.
- [ ] 1.4 Link from the README subsection to the deeper architecture
       reference for credential precedence and troubleshooting.

## 2. Architecture — credential reference

- [ ] 2.1 In `docs/architecture.md` under Mode A, add a "Configuring the
       Anthropic credential" subsection that documents both credential
       options and the GitHub-secret registration steps in more depth
       than the README.
- [ ] 2.2 Document credential precedence — what happens when both
       `ANTHROPIC_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN` are set —
       matching the behaviour of the underlying `claude-code-action`.
- [ ] 2.3 Add a troubleshooting entry describing the failure surface
       when neither credential is set (which step fails, the error
       message users see, and how to remediate).

## 3. Verification

- [ ] 3.1 Confirm both docs reference the same credential set as
       `.github/workflows/openspec-flow.yml` (`ANTHROPIC_API_KEY`,
       `CLAUDE_CODE_OAUTH_TOKEN`).
- [ ] 3.2 Run `openspec validate ensure-anthropic-key-config --strict`
       and resolve any reported issues.
- [ ] 3.3 Confirm there are no other docs (e.g. `docs/developer-guide.md`,
       `docs/app-setup.md`, `public/index.html`) that contradict the new
       credential guidance; update or note as out of scope.
