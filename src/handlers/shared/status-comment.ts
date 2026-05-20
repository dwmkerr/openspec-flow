// Single-sticky-comment lifecycle helpers.
//
// Dispatcher creates one status comment per intent on the target
// issue/PR. Handlers update that same comment at milestones via
// PATCH instead of posting new comments. Reviewers see one
// up-to-date status per intent, not a thread of partial updates.
//
// Both calls go through raw octokit.request() — same pattern we
// use for addLabels — so we don't depend on the bundled plugin's
// shape.

export interface StatusOctokit {
  request: (route: string, params: Record<string, unknown>) => Promise<{
    data: { id: number };
  } | { data: unknown }>;
}

export interface StatusLogger {
  warn: (msg: string) => void;
}

export const createStatusComment = async (
  octokit: StatusOctokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<number> => {
  const response = (await octokit.request(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
    { owner, repo, issue_number: issueNumber, body },
  )) as { data: { id: number } };
  return response.data.id;
};

// Best-effort: a failed PATCH leaves the comment displaying a
// slightly stale state. The substantive artefact (branch / PR) is
// the real signal. Never throw — handlers must continue.
export const updateStatusComment = async (
  octokit: StatusOctokit,
  owner: string,
  repo: string,
  commentId: number | undefined,
  body: string,
  log?: StatusLogger,
): Promise<void> => {
  if (commentId === undefined) return;
  try {
    await octokit.request(
      "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
      { owner, repo, comment_id: commentId, body },
    );
  } catch (err) {
    log?.warn(`status comment update failed: ${(err as Error).message}`);
  }
};
