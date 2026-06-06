// Marker-based comment upsert. Lets two writers (App pre-gate +
// workflow handler) collaborate on the same comment without holding
// an in-memory comment id between them: the marker substring is the
// shared lookup key.
//
// Marker format is an HTML comment so it's invisible in rendered
// Markdown but trivial to substring-match. Callers are expected to
// build a marker that uniquely identifies the comment they want
// (e.g. `<!-- openspec-flow:issue-breadcrumb intent=create-impl
// issue=42 spec-pr=43 -->`).

export interface UpsertOctokit {
  request: (
    route: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: any }>;
}

export interface UpsertLogger {
  warn: (msg: string) => void;
}

// List page size — for issue/PR threads with >100 comments we'd need
// pagination, but the bot's breadcrumb comments land early in the
// thread and the per-issue volume of openspec-flow lifecycle events
// is small. Keep it simple until proven otherwise.
const PAGE_SIZE = 100;

export interface UpsertResult {
  // `commentId` is null when the API write was attempted but failed
  // (best-effort path). Callers can use it to PATCH on subsequent
  // calls in the same process, skipping the list-find round-trip.
  commentId: number | null;
  // `created` is true when we POSTed a fresh comment; false when we
  // PATCHed an existing one. Useful for log distinguishability.
  created: boolean;
}

export const upsertCommentByMarker = async (
  octokit: UpsertOctokit,
  owner: string,
  repo: string,
  issueNumber: number,
  marker: string,
  body: string,
  log?: UpsertLogger,
): Promise<UpsertResult> => {
  // Find existing — short-circuit on first match.
  let existingId: number | null = null;
  try {
    const res = await octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      { owner, repo, issue_number: issueNumber, per_page: PAGE_SIZE },
    );
    const comments = (res.data ?? []) as { id: number; body: string }[];
    for (const c of comments) {
      if (typeof c.body === "string" && c.body.includes(marker)) {
        existingId = c.id;
        break;
      }
    }
  } catch (err) {
    log?.warn(`upsertCommentByMarker (list) failed: ${(err as Error).message}`);
    return { commentId: null, created: false };
  }

  // Body always carries the marker. Callers may forget to embed it;
  // appending here makes the upsert contract reliable.
  const composed = body.includes(marker) ? body : `${body}\n\n${marker}`;

  if (existingId !== null) {
    try {
      await octokit.request(
        "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
        { owner, repo, comment_id: existingId, body: composed },
      );
      return { commentId: existingId, created: false };
    } catch (err) {
      log?.warn(`upsertCommentByMarker (patch) failed: ${(err as Error).message}`);
      return { commentId: null, created: false };
    }
  }

  try {
    const res = await octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      { owner, repo, issue_number: issueNumber, body: composed },
    );
    const id = (res.data as { id?: number })?.id ?? null;
    return { commentId: id, created: true };
  } catch (err) {
    log?.warn(`upsertCommentByMarker (post) failed: ${(err as Error).message}`);
    return { commentId: null, created: false };
  }
};
