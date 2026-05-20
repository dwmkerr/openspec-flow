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
jest.mock("./git", () => ({
  cloneRepo: jest.fn(),
  configIdentity: jest.fn(),
  checkoutNewBranch: jest.fn(),
  addAll: jest.fn(),
  commit: jest.fn(),
  pushBranch: jest.fn(),
}));
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
  commit,
  pushBranch,
} from "./git.js";
import { assertOpenSpecCli, assertSkillPresent } from "./preconditions.js";
import { removeWorkdir } from "./workdir.js";

const buildOctokit = () => ({
  issues: {
    createComment: jest.fn().mockResolvedValue({}),
    addLabels: jest.fn().mockResolvedValue({}),
  },
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
    expect(commit).toHaveBeenCalledWith(
      "/tmp/openspec-flow/test-wd",
      "chore: Add CSV export",
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
    expect(opts.octokit.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: 10,
        body: "spec PR opened: #99",
      }),
    );
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

  it("aborts and posts failure comment when agent produces no change", async () => {
    (listNewChanges as jest.Mock).mockReturnValue([]);
    const opts = baseOpts();

    await expect(handleCreateSpec(opts)).rejects.toThrow(
      "agent didn't create any openspec changes",
    );
    expect(opts.octokit.pulls.create).not.toHaveBeenCalled();
    expect(opts.octokit.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("❌ openspec-flow couldn't open a spec PR"),
      }),
    );
    expect(removeWorkdir).toHaveBeenCalled();
  });

  it("posts failure comment + re-throws when precondition fails", async () => {
    (assertSkillPresent as jest.Mock).mockImplementationOnce(() => {
      throw new Error("openspec-new-change skill not found in target repo");
    });
    const opts = baseOpts();

    await expect(handleCreateSpec(opts)).rejects.toThrow("openspec-new-change skill");
    expect(opts.runner).not.toHaveBeenCalled();
    expect(opts.octokit.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("openspec-new-change skill"),
      }),
    );
  });

  it("posts failure comment when agent throws", async () => {
    const opts = baseOpts({
      runner: jest.fn().mockRejectedValue(new Error("api down")),
    });

    await expect(handleCreateSpec(opts)).rejects.toThrow("api down");
    expect(opts.octokit.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("api down") }),
    );
  });
});
