// Real create-spec handler. Bot does the deterministic mechanics
// (clone, branch, commit, push, PR open, comment). Claude does the
// scaffolding via the openspec-new-change skill inside the workdir.
// Failure surfaces as one visible comment on the originating issue.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAgent, type RunAgentLogger } from "../../agent/run.js";
import { branchName, expectedChangeName } from "./slug.js";
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
import { mutateLifecycleStickyEverywhere } from "../shared/lifecycle-sticky.js";
import { currentRun } from "../shared/run-link.js";

// True when the workflow's broker step or legacy App-secret step
// minted an installation token. Surfaces in the sticky footer as the
// "install the App for real-time updates" hint, so the absence of the
// App is visible to users tracking the comment.
const appInstalled = (): boolean =>
  process.env.OPENSPEC_FLOW_APP_INSTALLED === "true";
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

    // Tell the lifecycle sticky we're underway. Pre-gate posted
    // `preparing`; this flips it to `creating in workflow #N` so the
    // reader sees that work has actually started + has the run link.
    {
      const run = currentRun() ?? undefined;
      await mutateLifecycleStickyEverywhere(
        opts.octokit as any,
        opts.owner,
        opts.repo,
        { issueNumber: opts.issueNumber },
        {
          repo: { owner: opts.owner, name: opts.repo },
          spec: { kind: "creating", run },
          implementation: { kind: "not-started" },
        },
        (s) => ({ ...s, spec: { kind: "creating", run } }),
        { appInstalled: appInstalled() },
        { warn: opts.log.warn },
      );
    }

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

    // Deterministic change name threaded into the prompt so the agent
    // knows exactly which directory to write into, and the harness
    // knows exactly which directory to read. Without this, a stale
    // orphan change in openspec/changes/ would win the picker's
    // alphabetical-first selection over the agent's actual output.
    const wantedChangeName = expectedChangeName(opts.issueNumber, opts.issueTitle);
    const prompt = interpolate(PROMPT_TEMPLATE, {
      issueNumber: String(opts.issueNumber),
      issueTitle: opts.issueTitle,
      repo: `${opts.owner}/${opts.repo}`,
      changeName: wantedChangeName,
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
    // Prefer the prompt-threaded name; fall back to whatever exists
    // (with a warn log) if the agent ignored the instruction. The
    // fallback keeps a misbehaving agent from blocking the flow but
    // surfaces the drift so we can tighten the prompt later.
    const changeName = changes.includes(wantedChangeName) ? wantedChangeName : changes[0];
    if (changeName !== wantedChangeName) {
      opts.log.warn(
        `create-spec: agent didn't honour prompt-threaded name "${wantedChangeName}"; falling back to "${changeName}". Other dirs present: [${changes.join(", ")}]`,
      );
    }
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

    // Mutate the lifecycle sticky on the issue AND mirror to the
    // new spec PR. Same content, audience header on the PR variant.
    await mutateLifecycleStickyEverywhere(
      opts.octokit as any,
      opts.owner,
      opts.repo,
      { issueNumber: opts.issueNumber, prNumbers: [pr.data.number] },
      {
        repo: { owner: opts.owner, name: opts.repo },
        spec: { kind: "not-started" },
        implementation: { kind: "not-started" },
      },
      (s) => ({
        ...s,
        spec: { kind: "pr-open", prNumber: pr.data.number },
      }),
      { appInstalled: appInstalled() },
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
