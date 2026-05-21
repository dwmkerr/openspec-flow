// Content templates rendered by `openspec-flow init`. Pure strings.
// Keep these in one place so the CLI and the (future) App install
// handler render byte-identical output.

// HTML-comment markers bound the managed README block. Same comment
// shape as the PR-body metadata block — invisible in rendered Markdown,
// machine-readable, survives copy-paste.
export const README_MARKER_START = "<!-- openspec-flow init-start -->";
export const README_MARKER_END = "<!-- openspec-flow init-end -->";

// Pinned to `main` while the package version is 0.0.0. Switch to
// `@v<x>.<y>.<z>` once we cut a real release.
const DEFAULT_REF = "main";

export const renderWorkflow = (ref: string = DEFAULT_REF): string => `# Maintained by openspec-flow. Edit the \`uses:\` ref to upgrade.
# Docs: https://github.com/dwmkerr/openspec-flow
name: openspec-flow
on:
  issues:
    types: [labeled]
  pull_request:
    types: [labeled]
  pull_request_review_comment:
    types: [created]
  issue_comment:
    types: [created]
jobs:
  flow:
    uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@${ref}
    secrets:
      ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
      OPENSPEC_FLOW_APP_ID: \${{ secrets.OPENSPEC_FLOW_APP_ID || '' }}
      OPENSPEC_FLOW_PRIVATE_KEY: \${{ secrets.OPENSPEC_FLOW_PRIVATE_KEY || '' }}
`;

export const renderReadmeBlock = (): string => `${README_MARKER_START}
## openspec-flow

This repo uses [openspec-flow](https://github.com/dwmkerr/openspec-flow) to drive spec-driven development from GitHub issues.

1. Open an issue describing the feature, fix, or task.
2. Add the \`openspec:go\` label.
3. openspec-flow opens a **spec PR** (\`openspec:spec\`). Review, comment, iterate (add \`openspec:go\` to the PR to re-run). Merge when happy.
4. openspec-flow opens an **impl PR** (\`openspec:impl\`). Review, iterate, merge. The originating issue closes automatically.

Required Actions secret: \`ANTHROPIC_API_KEY\`.
${README_MARKER_END}`;

export const renderMinimalReadme = (repoName: string): string => `# ${repoName}

${renderReadmeBlock()}
`;
