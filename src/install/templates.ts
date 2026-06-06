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

// Anchor for inserting a `with:` block immediately after the `uses:`
// line. The template always has secrets indented at 4 spaces; the
// with block is placed at the same indentation.
const USES_LINE_FOLLOWED_BY_SECRETS =
  /(uses: dwmkerr\/openspec-flow\/\.github\/workflows\/openspec-flow\.yml@\S+\n)(    secrets:)/;

export interface RenderWorkflowOptions {
  ref?: string;
  // When set, the rendered shim carries `with: broker_url: <url>` so
  // the reusable workflow uses this URL for OIDC token exchange. Omit
  // for local-dev installs that should fall through to the reusable
  // workflow's default. Repo-level `vars.OPENSPEC_FLOW_BROKER_URL`
  // still overrides this if a power user sets it.
  brokerUrl?: string;
  // Audience the broker requires on the OIDC token. Must match the
  // Probot host's `OPENSPEC_FLOW_BROKER_AUDIENCE`. Baked alongside
  // `broker_url` so dev / prod brokers each get their own audience.
  brokerAudience?: string;
}

export const renderWorkflow = (
  refOrOptions: string | RenderWorkflowOptions = DEFAULT_REF,
): string => {
  const opts: RenderWorkflowOptions =
    typeof refOrOptions === "string" ? { ref: refOrOptions } : refOrOptions;
  const ref = opts.ref ?? DEFAULT_REF;
  let content = readFileSync(WORKFLOW_TEMPLATE_PATH, "utf8");
  if (ref !== DEFAULT_REF) {
    // Only the `@ref` token varies between versions; everything else
    // is verbatim from the bundled template.
    content = content.replace(REF_LINE, `$1${ref}`);
  }
  if (opts.brokerUrl || opts.brokerAudience) {
    // Inject `with:` block between `uses:` and `secrets:`. Indented at
    // 4 spaces to match the existing `secrets:` indentation. Both
    // broker inputs share one block; either may be omitted.
    const lines: string[] = ["    with:"];
    if (opts.brokerUrl) lines.push(`      broker_url: '${opts.brokerUrl}'`);
    if (opts.brokerAudience) lines.push(`      broker_audience: '${opts.brokerAudience}'`);
    const withBlock = lines.join("\n") + "\n";
    content = content.replace(
      USES_LINE_FOLLOWED_BY_SECRETS,
      `$1${withBlock}$2`,
    );
  }
  return content;
};

// Badge block — placed near the top of the README (right under the
// H1) so it sits with the project's title-area badges. Its own marker
// pair lets the user remove it cleanly: leave the empty marker pair to
// keep it gone (install respects existing markers and won't re-add).
export const BADGE_MARKER_START = "<!-- openspec-flow badge-start -->";
export const BADGE_MARKER_END = "<!-- openspec-flow badge-end -->";

// `remote` is the target repo's `owner/name`. Returns null when no
// remote (caller skips the badge altogether).
export const renderBadgeBlock = (remote: string): string => {
  const base = `https://github.com/${remote}/actions/workflows/openspec-flow.yml`;
  return `${BADGE_MARKER_START}\n[![openspec-flow](${base}/badge.svg)](${base})\n${BADGE_MARKER_END}`;
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

export const renderMinimalReadme = (repoName: string, remote?: string | null): string => {
  const badge = remote ? `\n${renderBadgeBlock(remote)}\n` : "";
  return `# ${repoName}\n${badge}\n${renderReadmeBlock()}\n`;
};
