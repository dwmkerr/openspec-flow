// create-impl handler. Mirrors create-spec but for the impl phase.
//
// Sequential mode: triggered by the dispatcher on a spec-PR merge.
// Workdir clones main (which now has the merged spec); branch
// `feat/<n>-<slug>` off main; impl PR `base: main`.
//
// Chained mode: triggered by the create-spec handler immediately
// after opening the spec PR (when OPENSPEC_FLOW_CHAINED_MODE=true).
// Workdir clones, checks out the spec branch; branch
// `feat/<n>-<slug>` off it; impl PR `base: <spec-branch>` (stacked).
// GitHub auto-retargets to main when the spec PR later merges.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAgent, type RunAgentLogger } from "../../agent/run.js";
import { branchName } from "../create-spec/slug.js";
import { createWorkdir, removeWorkdir } from "../create-spec/workdir.js";
import { assertOpenSpecCli, assertSkillPresent } from "../create-spec/preconditions.js";
import {
  cloneRepo,
  configIdentity,
  fetchAndCheckoutBranch,
  checkoutNewBranch,
  headSha,
  pushBranch,
} from "../create-spec/git.js";
import { summariseProposal } from "../create-spec/changes.js";
import { parseSpecPrMetadata } from "../shared/spec-pr-metadata.js";
import { mutateLifecycleStickyEverywhere } from "../shared/lifecycle-sticky.js";
import { currentRun } from "../shared/run-link.js";

const appInstalled = (): boolean =>
  process.env.OPENSPEC_FLOW_APP_INSTALLED === "true";
import { verifyImplWorkdir } from "./verify.js";
import type { MinimalOctokit as SpecMinimalOctokit } from "../create-spec/index.js";

const PROMPT_TEMPLATE = readFileSync(join(__dirname, "prompt.md"), "utf8");

// Re-export the spec handler's MinimalOctokit shape, extended with
// pulls.get + pulls.update which the impl handler needs.
export interface MinimalOctokit extends SpecMinimalOctokit {
  pulls: SpecMinimalOctokit["pulls"] & {
    get: (params: { owner: string; repo: string; pull_number: number }) => Promise<{
      data: { body: string | null; head: { ref: string }; merged: boolean; state: string };
    }>;
  };
}

export type CreateImplMode = "sequential" | "chained";

export interface HandleCreateImplOpts {
  owner: string;
  repo: string;
  mode: CreateImplMode;
  specPrNumber: number;
  octokit: MinimalOctokit;
  gitPushToken: string;
  log: RunAgentLogger;
  // Chained mode: caller already knows everything. Sequential mode:
  // handler resolves these from the spec PR's body / metadata.
  changeName?: string;
  issueNumber?: number;
  issueTitle?: string;
  specBranch?: string;
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

const buildImplPrBody = (opts: {
  issueNumber: number;
  changeName: string;
  specPrNumber: number;
  summary: string;
}): string => {
  const head = opts.summary
    ? opts.summary
    : `Implementation PR for issue #${opts.issueNumber}.`;
  return `${head}\n\nCloses #${opts.issueNumber}.\n\n<!-- openspec-flow:auto-maintained — do not remove or edit\nissue: ${opts.issueNumber}\nkind: impl\nchange: ${opts.changeName}\nspec-pr: ${opts.specPrNumber}\n-->\n`;
};

export const handleCreateImpl = async (
  opts: HandleCreateImplOpts,
): Promise<{ prNumber: number; prUrl: string } | null> => {
  const identity = opts.botIdentity ?? DEFAULT_BOT_IDENTITY;
  const run = opts.runner ?? runAgent;

  let workdir = "";
  let implPrNumber: number | null = null;
  let resolvedIssue = opts.issueNumber;

  // Set the agent's current sub-step on the lifecycle sticky's
  // Implementation row. Mirrors to issue + spec PR (always known).
  const setImplStep = async (step: string) => {
    if (resolvedIssue === undefined) return;
    const r = currentRun() ?? undefined;
    await mutateLifecycleStickyEverywhere(
      opts.octokit as any,
      opts.owner,
      opts.repo,
      { issueNumber: resolvedIssue, prNumbers: [opts.specPrNumber] },
      {
        repo: { owner: opts.owner, name: opts.repo },
        spec: { kind: "pr-merged", prNumber: opts.specPrNumber },
        implementation: { kind: "creating", run: r, step },
      },
      (s) => ({
        ...s,
        implementation:
          s.implementation.kind === "creating"
            ? { ...s.implementation, step, run: s.implementation.run ?? r }
            : { kind: "creating", run: r, step },
      }),
      { appInstalled: appInstalled() },
      { warn: opts.log.warn },
    );
  };

  try {
    opts.log.info(`create-impl: starting (${opts.mode}) for spec PR #${opts.specPrNumber}`);

    // Resolve issueNumber, issueTitle, changeName, specBranch.
    let changeName = opts.changeName;
    let specBranch = opts.specBranch;
    let issueTitle = opts.issueTitle;
    if (opts.mode === "sequential" || !changeName || !specBranch || !resolvedIssue) {
      const pr = await opts.octokit.pulls.get({
        owner: opts.owner,
        repo: opts.repo,
        pull_number: opts.specPrNumber,
      });
      const meta = parseSpecPrMetadata(pr.data.body);
      if (!meta) {
        throw new Error(`spec PR #${opts.specPrNumber} body has no openspec-flow metadata block`);
      }
      changeName = changeName ?? meta.change;
      resolvedIssue = resolvedIssue ?? meta.issue;
      specBranch = specBranch ?? pr.data.head.ref;
      // Sequential mode without a passed-in title — fall back to the
      // change name as the commit/PR title. Acceptable; the issue
      // title isn't reachable from the PR payload without an extra
      // Octokit call we can skip for now.
      issueTitle = issueTitle ?? changeName!;
    }
    if (!changeName || !specBranch || !resolvedIssue || !issueTitle) {
      throw new Error("could not resolve change context (changeName/issueNumber/specBranch/issueTitle)");
    }

    // Tell the lifecycle sticky we're underway. Pre-gate marked
    // implementation=preparing; this flips to creating-in-workflow.
    {
      const run = currentRun() ?? undefined;
      await mutateLifecycleStickyEverywhere(
        opts.octokit as any,
        opts.owner,
        opts.repo,
        { issueNumber: resolvedIssue, prNumbers: [opts.specPrNumber] },
        {
          repo: { owner: opts.owner, name: opts.repo },
          spec: { kind: "pr-merged", prNumber: opts.specPrNumber },
          implementation: { kind: "creating", run },
        },
        (s) => ({ ...s, implementation: { kind: "creating", run } }),
        { appInstalled: appInstalled() },
        { warn: opts.log.warn },
      );
    }

    workdir = createWorkdir(resolvedIssue);
    opts.log.info(`create-impl: workdir=${workdir}`);

    cloneRepo(`${opts.owner}/${opts.repo}`, workdir, opts.gitPushToken);
    configIdentity(workdir, identity.name, identity.email);

    if (opts.mode === "chained") {
      // Spec PR isn't merged yet — check out the spec branch so the
      // workdir reflects spec changes before we ask the agent to
      // implement on top of them.
      fetchAndCheckoutBranch(workdir, specBranch);
    }

    // Pre-create the impl branch so the agent commits directly onto it.
    const branch = branchName(resolvedIssue, issueTitle).replace(/^chore\//, "feat/");
    checkoutNewBranch(workdir, branch);

    assertOpenSpecCli();
    assertSkillPresent(workdir);

    const prompt = interpolate(PROMPT_TEMPLATE, {
      changeName,
      repo: `${opts.owner}/${opts.repo}`,
    });

    await setImplStep(`implementing change ${changeName}`);

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

    const verify = verifyImplWorkdir(workdir, changeName);
    if (!verify.ok) {
      throw new Error(verify.reason!);
    }
    opts.log.info(`create-impl: workdir verified — change archived, committed`);

    await setImplStep("pushing");

    pushBranch(workdir, branch);
    opts.log.info(`create-impl: pushed ${branch}`);

    // Summarise from the archived proposal — it's the post-archive
    // location now.
    const archiveSummary = summariseProposal(
      workdir,
      `archive/${new Date().toISOString().slice(0, 10)}-${changeName}`,
    );

    const body = buildImplPrBody({
      issueNumber: resolvedIssue,
      changeName,
      specPrNumber: opts.specPrNumber,
      summary: archiveSummary,
    });

    const base = opts.mode === "chained" ? specBranch : "main";
    const pr = await opts.octokit.pulls.create({
      owner: opts.owner,
      repo: opts.repo,
      title: `feat: ${issueTitle}`,
      head: branch,
      base,
      body,
    });
    implPrNumber = pr.data.number;

    await opts.octokit.issues.addLabels({
      owner: opts.owner,
      repo: opts.repo,
      issue_number: pr.data.number,
      labels: ["openspec:impl"],
    });

    // Advance the issue lifecycle breadcrumb on the originating issue
    // (spec merged + impl opened). Best-effort. resolvedIssue comes
    // from the spec-PR metadata when not passed directly.
    if (resolvedIssue !== undefined) {
      // Mutate sticky on the issue + mirror to both PRs (spec PR
      // already merged but the comment thread still benefits from
      // the consolidated view) + the new impl PR.
      await mutateLifecycleStickyEverywhere(
        opts.octokit as any,
        opts.owner,
        opts.repo,
        {
          issueNumber: resolvedIssue,
          prNumbers: [opts.specPrNumber, pr.data.number],
        },
        {
          repo: { owner: opts.owner, name: opts.repo },
          spec: { kind: "pr-merged", prNumber: opts.specPrNumber },
          implementation: { kind: "not-started" },
        },
        (s) => ({
          ...s,
          spec: { kind: "pr-merged", prNumber: opts.specPrNumber },
          implementation: { kind: "pr-open", prNumber: pr.data.number },
        }),
        { appInstalled: appInstalled() },
        { warn: opts.log.warn },
      );

    }

    opts.log.info(`create-impl: done — ${pr.data.html_url}`);
    return { prNumber: pr.data.number, prUrl: pr.data.html_url };
  } catch (err) {
    const msg = (err as Error).message;
    // Failure surfaces on the lifecycle sticky (mirrored to issue +
    // spec PR + impl PR if opened). The reviewer of any of those
    // threads sees the warning in the same comment they were
    // tracking.
    if (resolvedIssue !== undefined) {
      const failurePrs = implPrNumber !== null ? [opts.specPrNumber, implPrNumber] : [opts.specPrNumber];
      await mutateLifecycleStickyEverywhere(
        opts.octokit as any,
        opts.owner,
        opts.repo,
        { issueNumber: resolvedIssue, prNumbers: failurePrs },
        {
          repo: { owner: opts.owner, name: opts.repo },
          spec: { kind: "pr-merged", prNumber: opts.specPrNumber },
          implementation: { kind: "failed" },
        },
        (s) => ({
          ...s,
          implementation: { kind: "failed" },
          failure: { phase: "implementation", reason: msg },
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
