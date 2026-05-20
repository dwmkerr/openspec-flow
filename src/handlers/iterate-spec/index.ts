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
import { updateStatusComment } from "../shared/status-comment.js";
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

  const statusLog = { warn: opts.log.warn };
  const setStatus = (body: string) =>
    updateStatusComment(
      opts.octokit as any,
      opts.owner,
      opts.repo,
      opts.statusCommentId,
      body,
      statusLog,
    );

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

    await setStatus(`📖 reading review context for PR #${opts.specPrNumber}…`);

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

    await setStatus(`🔧 agent finished, pushing branch…`);

    pushBranch(workdir, branch);
    opts.log.info(`iterate-spec: pushed ${branch}`);

    await setStatus("✅ spec updated by openspec-flow");

    opts.log.info(`iterate-spec: done`);
  } catch (err) {
    const msg = (err as Error).message;
    await setStatus(
      `❌ openspec-flow failed: ${msg}. See dev logs for trace.`,
    );
    throw err;
  } finally {
    if (workdir) removeWorkdir(workdir);
  }
};
