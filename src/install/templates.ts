// Content templates rendered by `openspec-flow install`.
//
// The workflow shim is the single source of truth at
// `templates/openspec-flow.yml` in this repo (also the file the
// future fetch-from-release path will download). It resolves at
// repo root from both `dist/install/` and `src/install/` via `../../`,
// since `templates/` is never copied into either tree.
//
// The README block is CLI-rendered prose, not a distributable
// artefact, so it stays inline.

import { readFileSync } from "node:fs";
import { join } from "node:path";

// HTML-comment markers bound the managed README block. Same comment
// shape as the PR-body metadata block — invisible in rendered Markdown,
// machine-readable, survives copy-paste.
export const README_MARKER_START = "<!-- openspec-flow install-start -->";
export const README_MARKER_END = "<!-- openspec-flow install-end -->";

// Pinned to `main` while the package version is 0.0.0. Switch to
// `@v<x>.<y>.<z>` once we cut a real release (see ideas.md —
// fetch-from-release + version pin).
const DEFAULT_REF = "main";

const WORKFLOW_TEMPLATE_PATH = join(
  __dirname,
  "..",
  "..",
  "templates",
  "openspec-flow.yml",
);

const REF_LINE =
  /(uses: dwmkerr\/openspec-flow\/\.github\/workflows\/openspec-flow\.yml@)\S+/;

export const renderWorkflow = (ref: string = DEFAULT_REF): string => {
  const base = readFileSync(WORKFLOW_TEMPLATE_PATH, "utf8");
  if (ref === DEFAULT_REF) return base;
  // Only the `@ref` token varies between versions; everything else
  // is verbatim from the bundled template.
  return base.replace(REF_LINE, `$1${ref}`);
};

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
