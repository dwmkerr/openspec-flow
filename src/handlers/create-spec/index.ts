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
  addAll,
  commit,
  pushBranch,
} from "./git.js";
import { listNewChanges, summariseProposal } from "./changes.js";
import { buildSpecPrBody } from "./pr.js";

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
  // Hook for tests to substitute the agent runner.
  runner?: typeof runAgent;
}

const DEFAULT_BOT_IDENTITY = {
  name: "openspec-flow[bot]",
  email: "openspec-flow[bot]@users.noreply.github.com",
};

const interpolate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);

const postIssueComment = async (
  octokit: MinimalOctokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> => {
  try {
    await octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  } catch (err) {
    // Swallow comment failures — the PR (if it got that far) is the
    // substantive artefact; a missing comment doesn't block the flow.
  }
};

export const handleCreateSpec = async (
  opts: HandleCreateSpecOpts,
): Promise<{ prNumber: number; prUrl: string } | null> => {
  const identity = opts.botIdentity ?? DEFAULT_BOT_IDENTITY;
  const run = opts.runner ?? runAgent;

  let workdir = "";
  try {
    opts.log.info(`create-spec: starting for issue #${opts.issueNumber}`);

    workdir = createWorkdir(opts.issueNumber);
    opts.log.info(`create-spec: workdir=${workdir}`);

    cloneRepo(`${opts.owner}/${opts.repo}`, workdir, opts.gitPushToken);
    configIdentity(workdir, identity.name, identity.email);

    assertOpenSpecCli();
    assertSkillPresent(workdir);

    const prompt = interpolate(PROMPT_TEMPLATE, {
      issueNumber: String(opts.issueNumber),
      issueTitle: opts.issueTitle,
      repo: `${opts.owner}/${opts.repo}`,
    });

    await run({
      prompt,
      cwd: workdir,
      log: opts.log,
      options: {
        // Unattended run: skip permission prompts for Bash etc. The
        // workdir is throw-away and the agent has no network egress
        // beyond the tools we already trust (gh, openspec, git via
        // the bot's own steps).
        permissionMode: "bypassPermissions",
        // Inject GH_TOKEN so the agent's `gh issue view` succeeds.
        // Claude never logs env values; this is just subprocess inherit.
        env: { ...process.env, GH_TOKEN: opts.gitPushToken },
      } as any,
    });

    const changes = listNewChanges(workdir);
    if (changes.length === 0) {
      throw new Error("agent didn't create any openspec changes under openspec/changes/");
    }
    const changeName = changes[0];
    opts.log.info(`create-spec: agent produced change "${changeName}"${changes.length > 1 ? ` (+${changes.length - 1} more)` : ""}`);

    const branch = branchName(opts.issueNumber, opts.issueTitle);
    checkoutNewBranch(workdir, branch);
    addAll(workdir);
    commit(workdir, `chore: ${opts.issueTitle}`);
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

    await postIssueComment(
      opts.octokit,
      opts.owner,
      opts.repo,
      opts.issueNumber,
      `spec PR opened: #${pr.data.number}`,
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
    await postIssueComment(
      opts.octokit,
      opts.owner,
      opts.repo,
      opts.issueNumber,
      `❌ openspec-flow couldn't open a spec PR: ${msg}. See dev logs for trace.`,
    );
    throw err;
  } finally {
    if (workdir) removeWorkdir(workdir);
  }
};
