// Derive the kebab branch slug from an issue title. Deterministic so
// re-triggering the flow on the same issue lands on the same branch.

export const branchSlug = (title: string, maxLen = 50): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");
  return slug || "untitled";
};

export const branchName = (issueNumber: number, title: string): string =>
  `chore/${issueNumber}-${branchSlug(title)}`;

// Deterministic change name threaded into the agent prompt so the
// harness knows which directory under openspec/changes/ to read
// after the run. Prevents the picker from picking an alphabetically-
// first stale orphan change when one is present in the user's repo.
// Prefix `issue-N-` disambiguates two issues with similar titles.
export const expectedChangeName = (
  issueNumber: number,
  title: string,
): string => `issue-${issueNumber}-${branchSlug(title)}`;
