// Parse the auto-maintained HTML comment metadata block out of an
// impl PR body. Same shape as spec-pr-metadata but matches `kind: impl`
// and carries the optional `spec-pr` backref.

export interface ImplPrMetadata {
  issue: number;
  change: string;
  specPr?: number;
  kind: "impl";
}

const BLOCK = /<!--\s*openspec-flow:auto-maintained[^]*?-->/;

const FIELD = (name: string): RegExp =>
  new RegExp(`(?:^|\\n)\\s*${name}\\s*:\\s*(.+?)\\s*(?:\\n|$)`);

export const parseImplPrMetadata = (
  body: string | null | undefined,
): ImplPrMetadata | null => {
  if (!body) return null;
  const block = body.match(BLOCK)?.[0];
  if (!block) return null;
  const kind = block.match(FIELD("kind"))?.[1];
  if (kind !== "impl") return null;
  const issue = Number(block.match(FIELD("issue"))?.[1]);
  const change = block.match(FIELD("change"))?.[1];
  if (!Number.isFinite(issue) || !change) return null;
  const specPrRaw = block.match(FIELD("spec-pr"))?.[1];
  const specPr = specPrRaw !== undefined ? Number(specPrRaw) : undefined;
  return {
    issue,
    change,
    kind,
    ...(specPr !== undefined && Number.isFinite(specPr) ? { specPr } : {}),
  };
};
