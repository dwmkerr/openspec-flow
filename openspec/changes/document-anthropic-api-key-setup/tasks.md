## 1. README — canonical install instructions

- [ ] 1.1 Add a new subsection under the existing "Install" section titled
      "Configure the Anthropic API key" with a stable kebab-case heading
      slug.
- [ ] 1.2 In that subsection, document where to obtain the key
      (`console.anthropic.com`).
- [ ] 1.3 Document the exact GitHub UI path
      (Settings → Secrets and variables → Actions → New repository secret)
      and the required secret name `ANTHROPIC_API_KEY`.
- [ ] 1.4 Explain the shim forwarding contract: the value inside
      `${{ secrets.ANTHROPIC_API_KEY }}` names the repo-level Actions
      secret and must match what the operator created.
- [ ] 1.5 Document `CLAUDE_CODE_OAUTH_TOKEN` as an accepted alternative
      in one or two sentences, with a link to the Claude Code docs.
- [ ] 1.6 Add a "Verify it works" subsection: re-add `openspec:start`
      to a labelled issue, watch the agent step log, point at the
      authentication / 401 failure line that indicates a missing or
      wrong secret.
- [ ] 1.7 Update the existing install snippet so the comment under it
      links to the new section by anchor instead of listing secrets
      inline.

## 2. Architecture doc — cross-link

- [ ] 2.1 Under `docs/architecture.md` → "Mode A — Action install",
      add a short "Configuring secrets" paragraph that names
      `ANTHROPIC_API_KEY` and links to the README section by its
      heading slug.
- [ ] 2.2 Verify no duplicate step-by-step instructions remain in
      `docs/architecture.md` — the README is the single source.

## 3. .env.example disambiguation

- [ ] 3.1 Add a one-line comment above `ANTHROPIC_API_KEY=` in
      `.env.example` stating that this file is for local
      Probot/App-mode development and that shim-mode installs
      configure the same secret via repo Actions secrets, with a
      pointer to the README section.

## 4. Cross-check and validation

- [ ] 4.1 Re-read CLAUDE.md → "Install modes" to confirm the README
      and architecture changes do not contradict the canonical
      contract.
- [ ] 4.2 Run `openspec validate document-anthropic-api-key-setup
      --strict` and resolve any failures.
- [ ] 4.3 Spot-check broken anchors: open the rendered README and
      architecture doc on the PR preview and confirm the heading
      slug link resolves.
