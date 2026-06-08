// iterate-impl handler. Reviewer applied `openspec:go` on an open
// impl PR. We clone, check out the impl branch, give the agent the
// PR + issue context, let it rewrite code/tests/docs, and commit on
// the existing branch. Mirrors iterate-spec, scoped to code.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAgent, type RunAgentLogger } from "../../agent/run.js";
import { createWorkdir, removeWorkdir } from "../create-spec/workdir.js";
import {
  cloneRepo,
  configIdentity,
  fetchAndCheckoutBranch,
  headSha,
  pushBranch,
} from "../create-spec/git.js";
import { parseImplPrMetadata } from "../shared/impl-pr-metadata.js";
import { mutateLifecycleStickyEverywhere } from "../shared/lifecycle-sticky.js";
import { currentRun } from "../shared/run-link.js";

const appInstalled = (): boolean =>
  process.env.OPENSPEC_FLOW_APP_INSTALLED === "true";
import { verifyIterateImplWorkdir } from "./verify.js";
import type { MinimalOctokit } from "../create-impl/index.js";

const PROMPT_TEMPLATE = readFileSync(join(__dirname, "prompt.md"), "utf8");

export interface HandleIterateImplOpts {
  owner: string;
  repo: string;
  implPrNumber: number;
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

export const handleIterateImpl = async (
  opts: HandleIterateImplOpts,
): Promise<void> => {
  const identity = opts.botIdentity ?? DEFAULT_BOT_IDENTITY;
  const run = opts.runner ?? runAgent;

  let workdir = "";

  // Issue + spec PR resolved from impl PR metadata below; setImplStep
  // guards on resolvedIssue (no-op until resolved).
  let resolvedIssue: number | undefined;
  let resolvedSpecPr: number | undefined;
  const setImplStep = async (step: string) => {
    if (resolvedIssue === undefined) return;
    const r = currentRun() ?? undefined;
    const prs = resolvedSpecPr !== undefined
      ? [resolvedSpecPr, opts.implPrNumber]
      : [opts.implPrNumber];
    await mutateLifecycleStickyEverywhere(
      opts.octokit as any,
      opts.owner,
      opts.repo,
      { issueNumber: resolvedIssue, prNumbers: prs },
      {
        repo: { owner: opts.owner, name: opts.repo },
        spec:
          resolvedSpecPr !== undefined
            ? { kind: "pr-merged", prNumber: resolvedSpecPr }
            : { kind: "not-started" },
        implementation: {
          kind: "pr-iterating",
          prNumber: opts.implPrNumber,
          run: r,
          step,
        },
      },
      (s) => ({
        ...s,
        implementation:
          s.implementation.kind === "pr-iterating"
            ? { ...s.implementation, step, run: s.implementation.run ?? r }
            : {
                kind: "pr-iterating",
                prNumber: opts.implPrNumber,
                run: r,
                step,
              },
      }),
      { appInstalled: appInstalled() },
      { warn: opts.log.warn },
    );
  };

  try {
    opts.log.info(`iterate-impl: starting for impl PR #${opts.implPrNumber}`);

    const pr = await opts.octokit.pulls.get({
      owner: opts.owner,
      repo: opts.repo,
      pull_number: opts.implPrNumber,
    });

    if (pr.data.state !== "open") {
      throw new Error("PR is closed");
    }

    const meta = parseImplPrMetadata(pr.data.body);
    if (!meta) {
      throw new Error(
        `impl PR #${opts.implPrNumber} body has no openspec-flow impl metadata block`,
      );
    }

    const branch = pr.data.head.ref;
    const { change: changeName, issue: issueNumber } = meta;
    resolvedIssue = issueNumber;
    resolvedSpecPr = meta.specPr;

    // Tell the lifecycle sticky: impl PR iterating in workflow #N.
    {
      const run = currentRun() ?? undefined;
      const prsForSticky = meta.specPr !== undefined
        ? [meta.specPr, opts.implPrNumber]
        : [opts.implPrNumber];
      await mutateLifecycleStickyEverywhere(
        opts.octokit as any,
        opts.owner,
        opts.repo,
        { issueNumber, prNumbers: prsForSticky },
        {
          repo: { owner: opts.owner, name: opts.repo },
          spec:
            meta.specPr !== undefined
              ? { kind: "pr-merged", prNumber: meta.specPr }
              : { kind: "not-started" },
          implementation: { kind: "pr-iterating", prNumber: opts.implPrNumber, run },
        },
        (s) => ({
          ...s,
          implementation: {
            kind: "pr-iterating",
            prNumber: opts.implPrNumber,
            run,
          },
        }),
        { appInstalled: appInstalled() },
        { warn: opts.log.warn },
      );
    }

    workdir = createWorkdir(opts.implPrNumber);
    opts.log.info(`iterate-impl: workdir=${workdir} branch=${branch}`);

    cloneRepo(`${opts.owner}/${opts.repo}`, workdir, opts.gitPushToken);
    configIdentity(workdir, identity.name, identity.email);
    fetchAndCheckoutBranch(workdir, branch);

    const prompt = interpolate(PROMPT_TEMPLATE, {
      changeName,
      prNumber: String(opts.implPrNumber),
      issueNumber: String(issueNumber),
      branch,
      repo: `${opts.owner}/${opts.repo}`,
    });

    await setImplStep("gathering review context");

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

    const verify = verifyIterateImplWorkdir(workdir);
    if (!verify.ok) {
      throw new Error(verify.reason!);
    }
    opts.log.info(`iterate-impl: workdir verified — code mutated, committed`);

    await setImplStep("pushing");

    pushBranch(workdir, branch);
    opts.log.info(`iterate-impl: pushed ${branch}`);

    // Iteration finished — flip back to pr-open.
    if (resolvedIssue !== undefined) {
      const prs = resolvedSpecPr !== undefined
        ? [resolvedSpecPr, opts.implPrNumber]
        : [opts.implPrNumber];
      await mutateLifecycleStickyEverywhere(
        opts.octokit as any,
        opts.owner,
        opts.repo,
        { issueNumber: resolvedIssue, prNumbers: prs },
        {
          repo: { owner: opts.owner, name: opts.repo },
          spec:
            resolvedSpecPr !== undefined
              ? { kind: "pr-merged", prNumber: resolvedSpecPr }
              : { kind: "not-started" },
          implementation: { kind: "pr-open", prNumber: opts.implPrNumber },
        },
        (s) => ({
          ...s,
          implementation: { kind: "pr-open", prNumber: opts.implPrNumber },
        }),
        { appInstalled: appInstalled() },
        { warn: opts.log.warn },
      );
    }

    opts.log.info(`iterate-impl: done`);
  } catch (err) {
    const msg = (err as Error).message;
    if (resolvedIssue !== undefined) {
      const failureRun = currentRun() ?? undefined;
      const prs = resolvedSpecPr !== undefined
        ? [resolvedSpecPr, opts.implPrNumber]
        : [opts.implPrNumber];
      await mutateLifecycleStickyEverywhere(
        opts.octokit as any,
        opts.owner,
        opts.repo,
        { issueNumber: resolvedIssue, prNumbers: prs },
        {
          repo: { owner: opts.owner, name: opts.repo },
          spec:
            resolvedSpecPr !== undefined
              ? { kind: "pr-merged", prNumber: resolvedSpecPr }
              : { kind: "not-started" },
          implementation: { kind: "failed" },
        },
        (s) => ({
          ...s,
          implementation: { kind: "failed" },
          failure: { phase: "implementation", reason: msg, run: failureRun },
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
