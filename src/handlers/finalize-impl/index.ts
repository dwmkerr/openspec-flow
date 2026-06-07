// finalize-impl handler. Runs when an openspec:impl PR merges. GitHub
// has already closed the originating issue via `Closes #N`; this
// handler's only job is to stamp the issue's lifecycle breadcrumb with
// the terminal line. No clone, no agent, no PR.

import { runAgent, type RunAgentLogger } from "../../agent/run.js";
import { parseImplPrMetadata } from "../shared/impl-pr-metadata.js";
import { upsertLifecycleComment } from "../shared/lifecycle-comment.js";
import { mutateLifecycleSticky } from "../shared/lifecycle-sticky.js";
import type { MinimalOctokit } from "../create-impl/index.js";

export interface HandleFinalizeImplOpts {
  owner: string;
  repo: string;
  implPrNumber: number;
  octokit: MinimalOctokit;
  gitPushToken: string;
  log: RunAgentLogger;
  statusCommentId?: number;
  statusTargetNumber?: number;
  // Unused; present so the handler matches the registry call shape.
  runner?: typeof runAgent;
}

export const handleFinalizeImpl = async (
  opts: HandleFinalizeImplOpts,
): Promise<void> => {
  opts.log.info(`finalize-impl: impl PR #${opts.implPrNumber} merged`);

  const pr = await opts.octokit.pulls.get({
    owner: opts.owner,
    repo: opts.repo,
    pull_number: opts.implPrNumber,
  });

  const meta = parseImplPrMetadata(pr.data.body);
  if (!meta) {
    opts.log.warn(
      `finalize-impl: impl PR #${opts.implPrNumber} has no metadata block; skipping lifecycle stamp`,
    );
    return;
  }

  // Issue is already closed (Closes #N); commenting on a closed issue
  // is allowed. Best-effort — upsert never throws.
  // specPr from impl metadata is optional; preserve any existing
  // pr-merged state in the sticky, fall back to a synthetic 0 only
  // when the sticky was empty AND specPr is missing (unlikely).
  const specPrFromMeta = meta.specPr;
  await mutateLifecycleSticky(
    opts.octokit as any,
    opts.owner,
    opts.repo,
    meta.issue,
    {
      repo: { owner: opts.owner, name: opts.repo },
      spec:
        specPrFromMeta !== undefined
          ? { kind: "pr-merged", prNumber: specPrFromMeta }
          : { kind: "not-started" },
      implementation: { kind: "pr-merged", prNumber: opts.implPrNumber },
    },
    (s) => ({
      ...s,
      spec:
        s.spec.kind === "pr-merged"
          ? s.spec
          : specPrFromMeta !== undefined
            ? { kind: "pr-merged", prNumber: specPrFromMeta }
            : s.spec,
      implementation: { kind: "pr-merged", prNumber: opts.implPrNumber },
    }),
    { warn: opts.log.warn },
  );

  await upsertLifecycleComment(
    opts.octokit as any,
    opts.owner,
    opts.repo,
    meta.issue,
    { phase: "impl-merged", specPr: meta.specPr, implPr: opts.implPrNumber },
    { warn: opts.log.warn },
  );

  opts.log.info(`finalize-impl: stamped lifecycle on issue #${meta.issue}`);
};
