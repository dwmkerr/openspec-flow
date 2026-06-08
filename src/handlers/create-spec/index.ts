// Real create-spec handler. Bot does the deterministic mechanics
// (clone, branch, commit, push, PR open, comment). Claude does the
// scaffolding via the openspec-new-change skill inside the workdir.
// Failure surfaces as one visible comment on the originating issue.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAgent, type RunAgentLogger } from "../../agent/run.js";
import { branchName } from "./slug.js";
import { createWorkdir, removeWorkdir } from "./workdir.js";
import { assertOpenSpecCli, assertSkillPresent } from "./preconditions.js";
import {
  cloneRepo,
  configIdentity,
  checkoutNewBranch,
  headSha,
  pushBranch,
} from "./git.js";
import { listNewChanges, summariseProposal } from "./changes.js";
import { buildSpecPrBody } from "./pr.js";
import { updateStatusComment } from "../shared/status-comment.js";
import { mutateLifecycleSticky } from "../shared/lifecycle-sticky.js";
import {
  statusReadingIssue,
  statusPushing,
  statusSpecPrOpened,
  statusFailure,
} from "../shared/status-bodies.js";

const PROMPT_TEMPLATE = readFileSync(join(__dirname, "prompt.md"), "utf8");

// Minimal Octokit surface the handler needs. Lets tests inject a
// stub without dragging in the full Octokit type.
export interface MinimalOctokit {
  issues: {
    createComment: (params: {
      owner: string;
      repo: string;
      issue_number: number;
      body: string;
    }) => Promise<unknown>;
    addLabels: (params: {
      owner: string;
      repo: string;
      issue_number: number;
      labels: string[];
    }) => Promise<unknown>;
  };
  pulls: {
    create: (params: {
      owner: string;
      repo: string;
      title: string;
      head: string;
      base: string;
      body: string;
    }) => Promise<{ data: { number: number; html_url: string } }>;
  };
}

export interface HandleCreateSpecOpts {
  owner: string;
  repo: string;
  issueNumber: number;
  issueTitle: string;
  octokit: MinimalOctokit;
  gitPushToken: string;
  log: RunAgentLogger;
  botIdentity?: { name: string; email: string };
  // Sticky status comment id (created by the dispatcher). When set,
  // the handler PATCHes this comment at lifecycle milestones rather
  // than posting separate progress/final comments. Unset in CLI
  // mode — all status writes silently no-op.
  statusCommentId?: number;
  statusTargetNumber?: number;
  // Hook for tests to substitute the agent runner.
  runner?: typeof runAgent;
}

const DEFAULT_BOT_IDENTITY = {
  name: "openspec-flow[bot]",
  email: "openspec-flow[bot]@users.noreply.github.com",
};

const interpolate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);

export const handleCreateSpec = async (
  opts: HandleCreateSpecOpts,
): Promise<{ prNumber: number; prUrl: string } | null> => {
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
    opts.log.info(`create-spec: starting for issue #${opts.issueNumber}`);

    workdir = createWorkdir(opts.issueNumber);
    opts.log.info(`create-spec: workdir=${workdir}`);

    cloneRepo(`${opts.owner}/${opts.repo}`, workdir, opts.gitPushToken);
    configIdentity(workdir, identity.name, identity.email);

    // Pre-create the branch so the agent commits directly onto it.
    // Harness does branch + push deterministically; agent does the
    // commit (the message needs prose the agent is best placed to
    // write).
    const branch = branchName(opts.issueNumber, opts.issueTitle);
    checkoutNewBranch(workdir, branch);

    assertOpenSpecCli();
    assertSkillPresent(workdir);

    const prompt = interpolate(PROMPT_TEMPLATE, {
      issueNumber: String(opts.issueNumber),
      issueTitle: opts.issueTitle,
      repo: `${opts.owner}/${opts.repo}`,
    });

    await setStatus(statusReadingIssue(opts.issueNumber));

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

    const changes = listNewChanges(workdir);
    if (changes.length === 0) {
      throw new Error("agent didn't create any openspec changes under openspec/changes/");
    }
    const changeName = changes[0];
    opts.log.info(`create-spec: agent produced change "${changeName}"${changes.length > 1 ? ` (+${changes.length - 1} more)` : ""}`);

    await setStatus(statusPushing());

    pushBranch(workdir, branch);
    opts.log.info(`create-spec: pushed ${branch}`);

    const body = buildSpecPrBody({
      issueNumber: opts.issueNumber,
      changeName,
      summary: summariseProposal(workdir, changeName),
    });

    const pr = await opts.octokit.pulls.create({
      owner: opts.owner,
      repo: opts.repo,
      title: `chore: ${opts.issueTitle}`,
      head: branch,
      base: "main",
      body,
    });

    await opts.octokit.issues.addLabels({
      owner: opts.owner,
      repo: opts.repo,
      issue_number: pr.data.number,
      labels: ["openspec:spec"],
    });

    await setStatus(statusSpecPrOpened(pr.data.number));

    // Mutate the issue's lifecycle sticky: spec phase has a PR open.
    await mutateLifecycleSticky(
      opts.octokit as any,
      opts.owner,
      opts.repo,
      opts.issueNumber,
      {
        repo: { owner: opts.owner, name: opts.repo },
        spec: { kind: "not-started" },
        implementation: { kind: "not-started" },
      },
      (s) => ({
        ...s,
        spec: { kind: "pr-open", prNumber: pr.data.number },
      }),
      { warn: opts.log.warn },
    );


    opts.log.info(`create-spec: done — ${pr.data.html_url}`);

    // Chained mode: immediately invoke the impl handler on top of
    // the spec branch (stacked PR). Wrapped in its own try/catch so
    // an impl failure does not roll back the (successful) spec PR.
    if (process.env.OPENSPEC_FLOW_CHAINED_MODE?.toLowerCase() === "true") {
      opts.log.info("create-spec: chained mode — invoking create-impl");
      try {
        const { handleCreateImpl } = await import("../create-impl/index.js");
        await handleCreateImpl({
          owner: opts.owner,
          repo: opts.repo,
          mode: "chained",
          specPrNumber: pr.data.number,
          specBranch: branch,
          changeName,
          issueNumber: opts.issueNumber,
          issueTitle: opts.issueTitle,
          octokit: opts.octokit as any,
          gitPushToken: opts.gitPushToken,
          log: opts.log,
        });
      } catch (chainedErr) {
        opts.log.warn(
          `create-spec: chained impl failed: ${(chainedErr as Error).message}`,
        );
      }
    }

    return { prNumber: pr.data.number, prUrl: pr.data.html_url };
  } catch (err) {
    const msg = (err as Error).message;
    await setStatus(statusFailure(msg));
    throw err;
  } finally {
    if (workdir) removeWorkdir(workdir);
  }
};
