// Dispatch core — shared by the Probot adapter (src/index.ts) and the
// GitHub Action adapter (the `openspec-flow dispatch` CLI command).
//
// Owns the actionable-intent sequence: eyes reaction, sticky status
// comment, visible-noop terminal, lazy token mint, registry dispatch,
// unhandled-intent visible failure, error catch. Depends only on a
// minimal octokit, repo coordinates, a logger, and a getToken callback
// — never on Probot's Context. The silent-noop log shortcut stays in
// each adapter (it's a per-adapter logging concern).

import { Intent, describe } from "./intent.js";
import { dispatchTo } from "./handlers/registry.js";
import {
  createStatusComment,
  updateStatusComment,
} from "./handlers/shared/status-comment.js";
import { statusReceived } from "./handlers/shared/status-bodies.js";
import type { RunAgentLogger } from "./agent/run.js";
import type { MinimalOctokit } from "./handlers/create-impl/index.js";

// The core needs the handler octokit surface plus the reactions
// endpoint for the eyes ack.
type DispatchOctokit = MinimalOctokit & {
  reactions: {
    createForIssue: (params: {
      owner: string;
      repo: string;
      issue_number: number;
      content: string;
    }) => Promise<unknown>;
  };
};

export interface DispatchDeps {
  octokit: DispatchOctokit;
  owner: string;
  repo: string;
  // The issue/PR number the intent targets (where the sticky comment
  // and eyes reaction live).
  targetNumber: number;
  log: RunAgentLogger;
  // Lazily mint a push/clone token. Called only on the actionable
  // branch — never for visible noops. Probot supplies an installation
  // token; the CLI supplies GITHUB_TOKEN or an App token.
  getToken: () => Promise<string>;
  // Optional structured-error logger; falls back to log.warn.
  logError?: (msg: string, err: Error) => void;
}

const reactEyes = async (deps: DispatchDeps): Promise<void> => {
  try {
    await deps.octokit.reactions.createForIssue({
      owner: deps.owner,
      repo: deps.repo,
      issue_number: deps.targetNumber,
      content: "eyes",
    });
  } catch (err) {
    deps.log.warn(`eyes reaction failed: ${(err as Error).message}`);
  }
};

// Run the actionable / visible-noop dispatch sequence. Callers must
// have already short-circuited silent noops and resolved targetNumber.
export const runDispatch = async (
  intent: Intent,
  deps: DispatchDeps,
): Promise<void> => {
  const summary = describe(intent);

  // Eyes reaction is the fast deterministic ack — best-effort, never
  // blocks the comment that follows.
  await reactEyes(deps);

  // One sticky status comment per intent. Visible noops are terminal:
  // the body is just the reason. Actionable intents start at "received"
  // and the handler mutates the body as it progresses.
  const body = intent.kind === "noop" ? summary : statusReceived(summary);

  let statusCommentId: number | undefined;
  try {
    statusCommentId = await createStatusComment(
      deps.octokit as any,
      deps.owner,
      deps.repo,
      deps.targetNumber,
      body,
    );
  } catch (err) {
    deps.log.warn(
      `status comment create failed; handler will run without upsert: ${(err as Error).message}`,
    );
  }

  // Visible-noop intents are terminal: the sticky comment carries the
  // reason and there's no handler to run.
  if (intent.kind === "noop") return;

  try {
    const token = await deps.getToken();
    if (!token) throw new Error("could not obtain a token");

    const result = await dispatchTo(intent, {
      owner: deps.owner,
      repo: deps.repo,
      octokit: deps.octokit,
      gitPushToken: token,
      log: deps.log,
      statusCommentId,
      statusTargetNumber: deps.targetNumber,
    });

    if (!result.dispatched) {
      // Classified intent has no handler yet. Surface it on the sticky
      // status comment so the reviewer doesn't see "Starting…" hang.
      deps.log.warn(`intent ${result.kind} classified but not implemented`);
      if (statusCommentId !== undefined) {
        await updateStatusComment(
          deps.octokit as any,
          deps.owner,
          deps.repo,
          statusCommentId,
          `❌ \`${result.kind}\` is classified but not implemented yet — manage manually.`,
          { warn: (m: string) => deps.log.warn(m) },
        );
      }
    }
  } catch (err) {
    const e = err as Error;
    if (deps.logError) deps.logError(`${intent.kind} handler failed`, e);
    else deps.log.warn(`${intent.kind} handler failed: ${e.message}`);
  }
};
