// Reaction helpers shared between the Probot adapter (pre-gate add +
// workflow_run-driven remove) and the dispatch core (always-on add +
// finally-remove). Both ops are best-effort and idempotent so the two
// paths can run in either order without throwing.

type ReactionLogger = { warn: (m: string) => void };

const EYES = "eyes" as const;

// Add a 👀 reaction on the issue/PR. GitHub returns 200 with the
// existing reaction on duplicate adds for the same content+user, so
// repeat calls are safe.
export const addEyes = async (
  octokit: any,
  owner: string,
  repo: string,
  issueNumber: number,
  log: ReactionLogger,
): Promise<void> => {
  try {
    await octokit.reactions.createForIssue({
      owner,
      repo,
      issue_number: issueNumber,
      content: EYES,
    });
  } catch (err) {
    log.warn(`addEyes failed for ${owner}/${repo}#${issueNumber}: ${(err as Error).message}`);
  }
};

// Remove every 👀 reaction from the issue/PR. List → filter → delete
// pattern; over-cleans on purpose so a re-trigger gets a fresh ack
// instead of stale ones piling up across iterations.
export const removeEyes = async (
  octokit: any,
  owner: string,
  repo: string,
  issueNumber: number,
  log: ReactionLogger,
): Promise<void> => {
  let reactions: { id: number }[];
  try {
    const res = await octokit.reactions.listForIssue({
      owner,
      repo,
      issue_number: issueNumber,
      content: EYES,
    });
    reactions = res.data ?? [];
  } catch (err) {
    log.warn(`removeEyes (list) failed for ${owner}/${repo}#${issueNumber}: ${(err as Error).message}`);
    return;
  }
  for (const r of reactions) {
    try {
      await octokit.reactions.deleteForIssue({
        owner,
        repo,
        issue_number: issueNumber,
        reaction_id: r.id,
      });
    } catch (err: any) {
      // 404 just means another path already removed it — fine.
      if (err?.status === 404) continue;
      log.warn(
        `removeEyes (delete ${r.id}) failed for ${owner}/${repo}#${issueNumber}: ${(err as Error).message}`,
      );
    }
  }
};
