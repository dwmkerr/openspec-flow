// Parse the auto-maintained HTML comment metadata block that the
// bot writes into spec / impl PR bodies (per CLAUDE.md). The block
// is the canonical linkage between issue, spec PR, and impl PR;
// the visible `Refs #N` (spec PR) / `Closes #N` (impl PR) line is
// the GitHub-facing fallback.

export interface SpecPrMetadata {
  issue: number;
  change: string;
  kind: "spec";
}

const BLOCK = /<!--\s*openspec-flow:auto-maintained[^]*?-->/;

const FIELD = (name: string): RegExp =>
  new RegExp(`(?:^|\\n)\\s*${name}\\s*:\\s*(.+?)\\s*(?:\\n|$)`);

export const parseSpecPrMetadata = (body: string | null | undefined): SpecPrMetadata | null => {
  if (!body) return null;
  const block = body.match(BLOCK)?.[0];
  if (!block) return null;
  const kind = block.match(FIELD("kind"))?.[1];
  if (kind !== "spec") return null;
  const issue = Number(block.match(FIELD("issue"))?.[1]);
  const change = block.match(FIELD("change"))?.[1];
  if (!Number.isFinite(issue) || !change) return null;
  return { issue, change, kind };
};
