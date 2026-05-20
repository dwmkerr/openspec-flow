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
