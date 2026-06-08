// iterate-spec handler. Reviewer applied `openspec:go` on an open
// spec PR. We clone the repo, check out the spec branch, hand the
// PR + issue context to the agent, let it rewrite the artefacts,
// then force-push the branch in place. No new branch, no new PR —
// the existing review thread stays intact.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAgent, type RunAgentLogger } from "../../agent/run.js";
import { createWorkdir, removeWorkdir } from "../create-spec/workdir.js";
import { assertOpenSpecCli, assertSkillPresent } from "../create-spec/preconditions.js";
import {
  cloneRepo,
  configIdentity,
  fetchAndCheckoutBranch,
  headSha,
  pushBranch,
} from "../create-spec/git.js";
import { parseSpecPrMetadata } from "../shared/spec-pr-metadata.js";
import { mutateLifecycleStickyEverywhere } from "../shared/lifecycle-sticky.js";
import { currentRun } from "../shared/run-link.js";

const appInstalled = (): boolean =>
  process.env.OPENSPEC_FLOW_APP_INSTALLED === "true";
import { verifyIterateWorkdir } from "./verify.js";
import type { MinimalOctokit } from "../create-impl/index.js";

const PROMPT_TEMPLATE = readFileSync(join(__dirname, "prompt.md"), "utf8");

export interface HandleIterateSpecOpts {
  owner: string;
  repo: string;
  specPrNumber: number;
  octokit: MinimalOctokit;
  gitPushToken: string;
  log: RunAgentLogger;
  botIdentity?: { name: string; email: string };
  statusCommentId?: number;
  statusTargetNumber?: number;
  runner?: typeof runAgent;
}

const DEFAULT_BOT_IDENTITY = {
  name: "openspec-flow[bot]",
  email: "openspec-flow[bot]@users.noreply.github.com",
};

const interpolate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);

export const handleIterateSpec = async (
  opts: HandleIterateSpecOpts,
): Promise<void> => {
  const identity = opts.botIdentity ?? DEFAULT_BOT_IDENTITY;
  const run = opts.runner ?? runAgent;

  let workdir = "";

  // Issue number resolved from PR metadata below; setSpecStep guards
  // on it (no-op until resolved). Captures the run id so the row's
  // workflow link stays consistent across step transitions.
  let resolvedIssue: number | undefined;
  const setSpecStep = async (step: string) => {
    if (resolvedIssue === undefined) return;
    const r = currentRun() ?? undefined;
    await mutateLifecycleStickyEverywhere(
      opts.octokit as any,
      opts.owner,
      opts.repo,
      { issueNumber: resolvedIssue, prNumbers: [opts.specPrNumber] },
      {
        repo: { owner: opts.owner, name: opts.repo },
        spec: { kind: "pr-iterating", prNumber: opts.specPrNumber, run: r, step },
        implementation: { kind: "not-started" },
      },
      (s) => ({
        ...s,
        spec:
          s.spec.kind === "pr-iterating"
            ? { ...s.spec, step, run: s.spec.run ?? r }
            : { kind: "pr-iterating", prNumber: opts.specPrNumber, run: r, step },
      }),
      { appInstalled: appInstalled() },
      { warn: opts.log.warn },
    );
  };

  try {
    opts.log.info(`iterate-spec: starting for spec PR #${opts.specPrNumber}`);

    const pr = await opts.octokit.pulls.get({
      owner: opts.owner,
      repo: opts.repo,
      pull_number: opts.specPrNumber,
    });

    if (pr.data.state !== "open") {
      throw new Error("PR is closed");
    }

    const meta = parseSpecPrMetadata(pr.data.body);
    if (!meta) {
      throw new Error(
        `spec PR #${opts.specPrNumber} body has no openspec-flow metadata block`,
      );
    }

    const branch = pr.data.head.ref;
    const { change: changeName, issue: issueNumber } = meta;
    resolvedIssue = issueNumber;

    // Tell the lifecycle sticky: spec PR iterating in workflow #N.
    {
      const run = currentRun() ?? undefined;
      await mutateLifecycleStickyEverywhere(
        opts.octokit as any,
        opts.owner,
        opts.repo,
        { issueNumber, prNumbers: [opts.specPrNumber] },
        {
          repo: { owner: opts.owner, name: opts.repo },
          spec: { kind: "pr-iterating", prNumber: opts.specPrNumber, run },
          implementation: { kind: "not-started" },
        },
        (s) => ({
          ...s,
          spec: { kind: "pr-iterating", prNumber: opts.specPrNumber, run },
        }),
        { appInstalled: appInstalled() },
        { warn: opts.log.warn },
      );
    }

    workdir = createWorkdir(opts.specPrNumber);
    opts.log.info(`iterate-spec: workdir=${workdir} branch=${branch}`);

    cloneRepo(`${opts.owner}/${opts.repo}`, workdir, opts.gitPushToken);
    configIdentity(workdir, identity.name, identity.email);
    fetchAndCheckoutBranch(workdir, branch);

    assertOpenSpecCli();
    assertSkillPresent(workdir);

    const prompt = interpolate(PROMPT_TEMPLATE, {
      changeName,
      prNumber: String(opts.specPrNumber),
      issueNumber: String(issueNumber),
      branch,
      repo: `${opts.owner}/${opts.repo}`,
    });

    await setSpecStep("gathering review context");

    const headBefore = headSha(workdir);

    await run({
      prompt,
      cwd: workdir,
      log: opts.log,
      options: {
        permissionMode: "bypassPermissions",
        env: { ...process.env, GH_TOKEN: opts.gitPushToken },
      } as any,
    });

    const headAfter = headSha(workdir);
    if (headBefore === headAfter) {
      throw new Error(
        "agent didn't commit any changes — HEAD is unchanged after the run",
      );
    }

    const verify = verifyIterateWorkdir(workdir, changeName);
    if (!verify.ok) {
      throw new Error(verify.reason!);
    }
    opts.log.info(`iterate-spec: workdir verified — change updated, committed`);

    await setSpecStep("pushing");

    pushBranch(workdir, branch);
    opts.log.info(`iterate-spec: pushed ${branch}`);

    // Iteration finished — flip back to pr-open so the sticky stops
    // showing "iterating in workflow #N" and reads as awaiting review
    // again. Mirrors to the spec PR.
    if (resolvedIssue !== undefined) {
      await mutateLifecycleStickyEverywhere(
        opts.octokit as any,
        opts.owner,
        opts.repo,
        { issueNumber: resolvedIssue, prNumbers: [opts.specPrNumber] },
        {
          repo: { owner: opts.owner, name: opts.repo },
          spec: { kind: "pr-open", prNumber: opts.specPrNumber },
          implementation: { kind: "not-started" },
        },
        (s) => ({
          ...s,
          spec: { kind: "pr-open", prNumber: opts.specPrNumber },
        }),
        { appInstalled: appInstalled() },
        { warn: opts.log.warn },
      );
    }

    opts.log.info(`iterate-spec: done`);
  } catch (err) {
    const msg = (err as Error).message;
    if (resolvedIssue !== undefined) {
      const failureRun = currentRun() ?? undefined;
      await mutateLifecycleStickyEverywhere(
        opts.octokit as any,
        opts.owner,
        opts.repo,
        { issueNumber: resolvedIssue, prNumbers: [opts.specPrNumber] },
        {
          repo: { owner: opts.owner, name: opts.repo },
          spec: { kind: "failed" },
          implementation: { kind: "not-started" },
        },
        (s) => ({
          ...s,
          spec: { kind: "failed" },
          failure: { phase: "spec", reason: msg, run: failureRun },
        }),
        { appInstalled: appInstalled() },
        { warn: opts.log.warn },
      );
    }
    throw err;
  } finally {
    if (workdir) removeWorkdir(workdir);
  }
};
