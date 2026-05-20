// Inspect the workdir to see what the agent produced. The bot reads
// the filesystem; the agent's reply text is not parsed.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export const listNewChanges = (workdir: string): string[] => {
  const dir = join(workdir, "openspec", "changes");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((entry) => {
    if (entry === "archive") return false;
    const full = join(dir, entry);
    return statSync(full).isDirectory();
  });
};

// First non-heading, non-empty paragraph of the change's proposal.md.
// Used as a short summary in the spec PR body.
export const summariseProposal = (
  workdir: string,
  changeName: string,
): string => {
  const proposalPath = join(
    workdir,
    "openspec",
    "changes",
    changeName,
    "proposal.md",
  );
  if (!existsSync(proposalPath)) return "";
  const text = readFileSync(proposalPath, "utf8");
  for (const para of text.split(/\n\s*\n/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    return trimmed;
  }
  return "";
};
