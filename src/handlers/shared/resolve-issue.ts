// Resolve the originating issue number for any actionable lifecycle
// intent. The lifecycle sticky comment lives on the issue (not on
// whichever PR the event happened to target), so most writers need to
// jump from a PR back to the issue.
//
// create-spec / create-impl carry the issue on the intent directly.
// iterate-spec / iterate-impl carry a PR number; we look up the PR
// body and parse the openspec-flow metadata block.

import type { Intent } from "../../intent.js";
import { parseSpecPrMetadata } from "./spec-pr-metadata.js";
import { parseImplPrMetadata } from "./impl-pr-metadata.js";

interface ResolverOctokit {
  pulls: {
    get: (params: { owner: string; repo: string; pull_number: number }) => Promise<{ data: { body?: string | null } }>;
  };
}

export const resolveIssueNumber = async (
  intent: Intent,
  octokit: ResolverOctokit,
  owner: string,
  repo: string,
): Promise<number | null> => {
  switch (intent.kind) {
    case "create-spec":
      return intent.issueNumber;
    case "create-impl":
      return intent.issueNumber;
    case "iterate-spec":
    case "iterate-impl": {
      try {
        const pr = await octokit.pulls.get({
          owner,
          repo,
          pull_number: intent.prNumber,
        });
        const meta =
          intent.kind === "iterate-spec"
            ? parseSpecPrMetadata(pr.data.body)
            : parseImplPrMetadata(pr.data.body);
        return meta?.issue ?? null;
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
};
