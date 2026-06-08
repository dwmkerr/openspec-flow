// Dispatch core — shared by the Probot adapter (src/index.ts) and the
// GitHub Action adapter (the `openspec-flow dispatch` CLI command).
//
// Owns the actionable-intent sequence: eyes reaction, sticky status
// comment, visible-noop terminal, lazy token mint, registry dispatch,
// unhandled-intent visible failure, error catch. Depends only on a
// minimal octokit, repo coordinates, a logger, and a getToken callback
// — never on Probot's Context. The silent-noop log shortcut stays in
// each adapter (it's a per-adapter logging concern).

import { Intent } from "./intent.js";
import { dispatchTo } from "./handlers/registry.js";
import type { RunAgentLogger } from "./agent/run.js";
import type { MinimalOctokit } from "./handlers/create-impl/index.js";
import { addEyes, removeEyes } from "./reactions.js";

// The core needs the handler octokit surface plus the reactions
// endpoints for the eyes lifecycle (add at start, remove at end).
type DispatchOctokit = MinimalOctokit & {
  reactions: {
    createForIssue: (params: any) => Promise<unknown>;
    listForIssue: (params: any) => Promise<any>;
    deleteForIssue: (params: any) => Promise<unknown>;
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

export interface DispatchResult {
  // false when an actionable intent's handler threw. Callers (CLI
  // dispatch step, Probot adapter) use this to bubble failure into
  // the runner's exit code so the workflow's red/green badge matches
  // reality. The error is logged here regardless; ok=false just makes
  // it visible at the process boundary.
  ok: boolean;
  error?: Error;
}

// Run the actionable / visible-noop dispatch sequence. Callers must
// have already short-circuited silent noops and resolved targetNumber.
//
// Reaction lifecycle: 👀 added on entry (covers Action-mode-only
// installs where Probot can't), removed on every exit path so a
// re-trigger gets a fresh ack instead of stale ones piling up. The
// Probot adapter may have already added the same reaction pre-gate;
// addEyes treats GitHub's 200-on-duplicate as success.
export const runDispatch = async (
  intent: Intent,
  deps: DispatchDeps,
): Promise<DispatchResult> => {
  // Eyes reaction is the fast deterministic ack — best-effort, never
  // blocks the comment that follows.
  await addEyes(deps.octokit as any, deps.owner, deps.repo, deps.targetNumber, deps.log);

  try {
    // Visible-noop intents are terminal: the lifecycle sticky on the
    // target was already updated by the Probot pre-gate (or will be
    // by the workflow handler). No per-target comment to post here.
    if (intent.kind === "noop") return { ok: true };

    try {
      const token = await deps.getToken();
      if (!token) throw new Error("could not obtain a token");

      const result = await dispatchTo(intent, {
        owner: deps.owner,
        repo: deps.repo,
        octokit: deps.octokit,
        gitPushToken: token,
        log: deps.log,
        // statusCommentId removed — handlers now mutate the lifecycle
        // sticky directly via mutateLifecycleStickyEverywhere.
        statusCommentId: undefined,
        statusTargetNumber: deps.targetNumber,
      });

      if (!result.dispatched) {
        // Classified intent has no handler yet. Surfaced as a warn +
        // ok=false so the run goes red.
        deps.log.warn(`intent ${result.kind} classified but not implemented`);
        return {
          ok: false,
          error: new Error(`intent ${result.kind} not implemented`),
        };
      }

      return { ok: true };
    } catch (err) {
      const e = err as Error;
      if (deps.logError) deps.logError(`${intent.kind} handler failed`, e);
      else deps.log.warn(`${intent.kind} handler failed: ${e.message}`);
      // Surfaced upward so the CLI dispatch step (action mode) exits
      // non-zero and the workflow run goes red — matches reality.
      // Today this silently exited 0 even when the agent crashed mid-run.
      return { ok: false, error: e };
    }
  } finally {
    // Always clear the ack so a re-trigger renders fresh eyes. The
    // Probot adapter's workflow_run.completed remove is the App-mode
    // backstop for cases where this finally never runs (process killed,
    // runner timeout); both are idempotent.
    await removeEyes(deps.octokit as any, deps.owner, deps.repo, deps.targetNumber, deps.log);
  }
};
