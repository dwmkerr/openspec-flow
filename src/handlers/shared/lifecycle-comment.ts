// Durable per-issue lifecycle breadcrumb. Unlike the ephemeral status
// sticky (one per intent, on the intent's target), this is a single
// comment on the *originating issue* that every lifecycle transition
// upserts into a growing checklist. Marker-keyed so each handler finds
// and edits the same comment rather than posting a thread.

export interface LifecycleOctokit {
  request: (
    route: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown }>;
}

export interface LifecycleLogger {
  warn: (msg: string) => void;
}

export const LIFECYCLE_MARKER = "<!-- openspec-flow:lifecycle -->";

// Ordered phases; later phases tick all earlier items.
export type LifecyclePhase =
  | "spec-opened"
  | "spec-merged"
  | "impl-opened"
  | "impl-merged";

const ORDER: Record<LifecyclePhase, number> = {
  "spec-opened": 1,
  "spec-merged": 2,
  "impl-opened": 3,
  "impl-merged": 4,
};

export interface LifecycleState {
  phase: LifecyclePhase;
  specPr?: number;
  implPr?: number;
}

const tick = (done: boolean): string => (done ? "✅" : "▢");

export const renderLifecycle = (s: LifecycleState): string => {
  const at = ORDER[s.phase];
  const specRef = s.specPr ? ` — #${s.specPr}` : "";
  const implRef = s.implPr ? ` — #${s.implPr}` : "";
  const lines = [
    "openspec-flow — lifecycle for this issue",
    "",
    `- ${tick(at >= 1)} spec PR opened${specRef}`,
    `- ${tick(at >= 2)} spec PR merged`,
    `- ${tick(at >= 3)} impl PR opened${implRef}`,
    `- ${tick(at >= 4)} implemented & merged${implRef}${at >= 4 ? " (issue closed)" : ""}`,
    "",
    LIFECYCLE_MARKER,
  ];
  return lines.join("\n");
};

const findLifecycleComment = async (
  octokit: LifecycleOctokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<number | undefined> => {
  // Page through issue comments looking for our marker. Issues rarely
  // have enough comments to need more than the default page.
  const res = (await octokit.request(
    "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
    { owner, repo, issue_number: issueNumber, per_page: 100 },
  )) as { data: Array<{ id: number; body?: string }> };
  return res.data.find((c) => (c.body ?? "").includes(LIFECYCLE_MARKER))?.id;
};

// Best-effort upsert: create the lifecycle comment if absent, else edit
// it in place. Never throws — a stale breadcrumb must not block the
// substantive work (PR open, push).
export const upsertLifecycleComment = async (
  octokit: LifecycleOctokit,
  owner: string,
  repo: string,
  issueNumber: number,
  state: LifecycleState,
  log?: LifecycleLogger,
): Promise<void> => {
  const body = renderLifecycle(state);
  try {
    const existing = await findLifecycleComment(octokit, owner, repo, issueNumber);
    if (existing !== undefined) {
      await octokit.request(
        "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
        { owner, repo, comment_id: existing, body },
      );
    } else {
      await octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        { owner, repo, issue_number: issueNumber, body },
      );
    }
  } catch (err) {
    log?.warn(`lifecycle comment upsert failed: ${(err as Error).message}`);
  }
};
