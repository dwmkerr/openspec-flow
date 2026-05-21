// Unit tests for the create-spec handler. Mock everything filesystem
// + git + runner so tests stay fast and offline. Each test sets up
// a minimal in-memory workdir layout via jest.mock of node:fs.

jest.mock("./workdir", () => ({
  createWorkdir: jest.fn(() => "/tmp/openspec-flow/test-wd"),
  removeWorkdir: jest.fn(),
}));
jest.mock("./preconditions", () => ({
  assertOpenSpecCli: jest.fn(),
  assertSkillPresent: jest.fn(),
}));
jest.mock("./git", () => {
  let counter = 0;
  return {
    cloneRepo: jest.fn(),
    configIdentity: jest.fn(),
    checkoutNewBranch: jest.fn(),
    pushBranch: jest.fn(),
    // headSha returns different values on subsequent calls so the
    // "HEAD moved" check passes by default. Tests can override.
    headSha: jest.fn(() => `sha-${++counter}`),
  };
});
jest.mock("./changes", () => ({
  listNewChanges: jest.fn(),
  summariseProposal: jest.fn(() => "Adds CSV export to orders page."),
}));

import { handleCreateSpec } from "./index.js";
import { listNewChanges } from "./changes.js";
import {
  cloneRepo,
  configIdentity,
  checkoutNewBranch,
  headSha,
  pushBranch,
} from "./git.js";
import { assertOpenSpecCli, assertSkillPresent } from "./preconditions.js";
import { removeWorkdir } from "./workdir.js";

const buildOctokit = () => ({
  issues: {
    createComment: jest.fn().mockResolvedValue({}),
    addLabels: jest.fn().mockResolvedValue({}),
  },
  // Raw request() is what the status-comment helper uses for the
  // PATCH /issues/comments/{id} milestone updates.
  request: jest.fn().mockResolvedValue({ data: {} }),
  pulls: {
    create: jest.fn().mockResolvedValue({
      data: { number: 99, html_url: "https://github.com/o/r/pull/99" },
    }),
  },
});

const baseOpts = (overrides: Partial<any> = {}) => {
  const log = { info: jest.fn(), warn: jest.fn() };
  return {
    owner: "o",
    repo: "r",
    issueNumber: 10,
    issueTitle: "Add CSV export",
    octokit: buildOctokit(),
    gitPushToken: "token",
    log,
    runner: jest.fn().mockResolvedValue("done"),
    statusCommentId: 555,
    statusTargetNumber: 10,
    ...overrides,
  } as any;
};

describe("handleCreateSpec", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listNewChanges as jest.Mock).mockReturnValue(["add-csv-export"]);
  });

  it("clones, checks preconditions, runs agent, branches, commits, pushes, opens PR, comments", async () => {
    const opts = baseOpts();

    const result = await handleCreateSpec(opts);

    expect(result).toEqual({
      prNumber: 99,
      prUrl: "https://github.com/o/r/pull/99",
    });
    expect(cloneRepo).toHaveBeenCalledWith("o/r", "/tmp/openspec-flow/test-wd", "token");
    expect(configIdentity).toHaveBeenCalled();
    expect(assertOpenSpecCli).toHaveBeenCalled();
    expect(assertSkillPresent).toHaveBeenCalledWith("/tmp/openspec-flow/test-wd");
    expect(opts.runner).toHaveBeenCalledTimes(1);
    expect(checkoutNewBranch).toHaveBeenCalledWith(
      "/tmp/openspec-flow/test-wd",
      "chore/10-add-csv-export",
    );
    expect(pushBranch).toHaveBeenCalledWith(
      "/tmp/openspec-flow/test-wd",
      "chore/10-add-csv-export",
    );
    expect(opts.octokit.pulls.create).toHaveBeenCalledTimes(1);
    const prArgs = opts.octokit.pulls.create.mock.calls[0][0];
    expect(prArgs.head).toBe("chore/10-add-csv-export");
    expect(prArgs.base).toBe("main");
    expect(prArgs.body).toContain("openspec-flow:auto-maintained");
    expect(prArgs.body).toContain("issue: 10");
    expect(prArgs.body).toContain("change: add-csv-export");
    expect(prArgs.body).toContain("Closes #10");
    expect(opts.octokit.issues.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["openspec:spec"] }),
    );
    // Status comment was PATCHed at milestones AND at the terminal
    // success state. No separate createComment was posted.
    const patchCalls = opts.octokit.request.mock.calls.filter(
      (c: any) => c[0].startsWith("PATCH /repos/"),
    );
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);
    const finalPatch = patchCalls[patchCalls.length - 1];
    expect(finalPatch[1].comment_id).toBe(555);
    expect(finalPatch[1].body).toBe("✅ spec PR opened: #99");
    expect(opts.octokit.issues.createComment).not.toHaveBeenCalled();
    expect(removeWorkdir).toHaveBeenCalledWith("/tmp/openspec-flow/test-wd");
  });

  it("interpolates issue context into the prompt", async () => {
    const opts = baseOpts();

    await handleCreateSpec(opts);

    const prompt = opts.runner.mock.calls[0][0].prompt;
    expect(prompt).toContain("#10");
    expect(prompt).toContain("Add CSV export");
    expect(prompt).toContain("o/r");
    expect(prompt).not.toContain("{{");
  });

  it("passes GH_TOKEN to the agent's subprocess env", async () => {
    const opts = baseOpts();

    await handleCreateSpec(opts);

    const env = opts.runner.mock.calls[0][0].options.env;
    expect(env.GH_TOKEN).toBe("token");
  });

  it("aborts and posts failure comment when agent didn't commit", async () => {
    (headSha as jest.Mock).mockReturnValueOnce("same-sha").mockReturnValueOnce("same-sha");
    const opts = baseOpts();

    await expect(handleCreateSpec(opts)).rejects.toThrow(
      "agent didn't commit any changes",
    );
    expect(pushBranch).not.toHaveBeenCalled();
    expect(opts.octokit.pulls.create).not.toHaveBeenCalled();
    // Failure terminal-state PATCHes the status comment, no new POST.
    const patchCalls = opts.octokit.request.mock.calls.filter(
      (c: any) => c[0].startsWith("PATCH /repos/"),
    );
    const finalPatch = patchCalls[patchCalls.length - 1];
    expect(finalPatch[1].body).toContain("⚠️ openspec-flow failed");
    expect(opts.octokit.issues.createComment).not.toHaveBeenCalled();
  });

  it("aborts and posts failure comment when agent produces no change", async () => {
    (listNewChanges as jest.Mock).mockReturnValue([]);
    const opts = baseOpts();

    await expect(handleCreateSpec(opts)).rejects.toThrow(
      "agent didn't create any openspec changes",
    );
    expect(opts.octokit.pulls.create).not.toHaveBeenCalled();
    // Failure terminal-state PATCHes the status comment, no new POST.
    const patchCalls = opts.octokit.request.mock.calls.filter(
      (c: any) => c[0].startsWith("PATCH /repos/"),
    );
    const finalPatch = patchCalls[patchCalls.length - 1];
    expect(finalPatch[1].body).toContain("⚠️ openspec-flow failed");
    expect(opts.octokit.issues.createComment).not.toHaveBeenCalled();
    expect(removeWorkdir).toHaveBeenCalled();
  });

  it("posts failure comment + re-throws when precondition fails", async () => {
    (assertSkillPresent as jest.Mock).mockImplementationOnce(() => {
      throw new Error("openspec-new-change skill not found in target repo");
    });
    const opts = baseOpts();

    await expect(handleCreateSpec(opts)).rejects.toThrow("openspec-new-change skill");
    expect(opts.runner).not.toHaveBeenCalled();
    const patchCalls = opts.octokit.request.mock.calls.filter(
      (c: any) => c[0].startsWith("PATCH /repos/"),
    );
    expect(patchCalls[patchCalls.length - 1][1].body).toContain("openspec-new-change skill");
  });

  it("posts failure comment when agent throws", async () => {
    const opts = baseOpts({
      runner: jest.fn().mockRejectedValue(new Error("api down")),
    });

    await expect(handleCreateSpec(opts)).rejects.toThrow("api down");
    const patchCalls = opts.octokit.request.mock.calls.filter(
      (c: any) => c[0].startsWith("PATCH /repos/"),
    );
    expect(patchCalls[patchCalls.length - 1][1].body).toContain("api down");
  });
});
