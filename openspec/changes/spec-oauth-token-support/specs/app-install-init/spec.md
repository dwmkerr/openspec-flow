# app-install-init Specification Delta

## MODIFIED Requirements

### Requirement: `installation.created` opens a per-repo init PR

The App SHALL handle the Probot `installation.created` event by invoking `runAppInit` once per repository included in the installation payload. For each repository that is not already initialised, `runAppInit` SHALL open a pull request from branch `chore/openspec-flow-init` against the repository's default branch, with a commit that:

- writes `.github/workflows/openspec-flow.yml` containing the shim workflow rendered for the installed CLI's version,
- inserts the badge managed region (`<!-- openspec-flow badge-start -->` … `<!-- openspec-flow badge-end -->`) under the README's first H1, creating `README.md` with a minimal template if absent,
- appends the install managed region (`<!-- openspec-flow install-start -->` … `<!-- openspec-flow install-end -->`) to the README.

The PR body SHALL explain what was added, document the `gh secret set` step for a Claude credential (mentioning both `CLAUDE_CODE_OAUTH_TOKEN` as recommended and `ANTHROPIC_API_KEY` as alternative — the user chooses exactly one), link to the openspec-flow docs, and SHALL NOT carry any `openspec:*` label.

#### Scenario: Fresh App install on a single uninitialised repo

- **GIVEN** the App is installed on `owner/repo`, the default branch is `main`, the README has no openspec-flow markers, and `.github/workflows/openspec-flow.yml` does not exist
- **WHEN** Probot receives `installation.created` for that installation
- **THEN** a pull request is opened against `main` from branch `chore/openspec-flow-init`
- **AND** the PR introduces the shim workflow file and both README managed regions
- **AND** the PR carries no `openspec:*` label

### Requirement: Init PR body names the Claude credential secret command

The PR body opened by `runAppInit` SHALL contain a section naming a Claude credential as required for the flow to run. The section SHALL provide a copy-pasteable `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R <owner>/<name>` command (filled in with the target repo) with an inline note that `ANTHROPIC_API_KEY` is an accepted alternative. The user SHALL set exactly one.

#### Scenario: PR body names the OAuth secret command with API-key alternative

- **WHEN** an init PR opens for `owner/repo`
- **THEN** the PR body contains the literal string `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R owner/repo`
- **AND** the same line or an adjacent line names `ANTHROPIC_API_KEY` as an alternative
