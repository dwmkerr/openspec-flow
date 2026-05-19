// Pure parser/serializer for the HTML-comment metadata block the bot
// embeds at the bottom of every PR body. The block is the canonical link
// between issue, spec PR, and impl PR.
//
// Schema (see CLAUDE.md):
//   <!-- openspec-flow:auto-maintained — do not remove or edit
//   issue: 42
//   kind: spec | impl
//   change: add-csv-export
//   spec-pr: 43       # only on impl PRs
//   -->

import YAML from "yaml";

export type PrKind = "spec" | "impl";

export interface PrMetadata {
  issue: number;
  kind: PrKind;
  change: string;
  specPr?: number;
}

const MARKER_PREFIX = "openspec-flow:auto-maintained";

export const serialize = (meta: PrMetadata): string => {
  const body: Record<string, unknown> = {
    issue: meta.issue,
    kind: meta.kind,
    change: meta.change,
  };
  if (meta.kind === "impl" && meta.specPr !== undefined) {
    body["spec-pr"] = meta.specPr;
  }
  // Keep the inner YAML as flat key:value lines — readable, minimal whitespace.
  const yaml = YAML.stringify(body, { lineWidth: 0 }).trimEnd();
  return `<!-- ${MARKER_PREFIX} — do not remove or edit\n${yaml}\n-->`;
};

// Match every comment whose opening line starts with the marker prefix,
// then keep the last one. Lets the bot's block live anywhere in the body.
const blockRegex = new RegExp(
  `<!--\\s*${MARKER_PREFIX}[^\\n]*\\n([\\s\\S]*?)\\s*-->`,
  "g",
);

export const parse = (body: string | null | undefined): PrMetadata | null => {
  if (!body) return null;
  const matches = [...body.matchAll(blockRegex)];
  if (matches.length === 0) return null;
  const inner = matches[matches.length - 1][1];

  let parsed: unknown;
  try {
    parsed = YAML.parse(inner);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const r = parsed as Record<string, unknown>;
  const issue = typeof r["issue"] === "number" ? r["issue"] : NaN;
  const kind = r["kind"];
  const change = r["change"];

  if (!Number.isFinite(issue) || (kind !== "spec" && kind !== "impl") || typeof change !== "string") {
    return null;
  }

  const out: PrMetadata = { issue, kind, change };
  if (kind === "impl" && typeof r["spec-pr"] === "number") {
    out.specPr = r["spec-pr"];
  }
  return out;
};
