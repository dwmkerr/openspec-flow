// Unit tests for create-impl. Mock filesystem, git, workdir, and
// preconditions so tests stay fast and offline.

jest.mock("../create-spec/workdir", () => ({
  createWorkdir: jest.fn(() => "/tmp/openspec-flow/impl-test-wd"),
  removeWorkdir: jest.fn(),
}));
jest.mock("../create-spec/preconditions", () => ({
  assertOpenSpecCli: jest.fn(),
  assertSkillPresent: jest.fn(),
}));
jest.mock("../create-spec/git", () => {
  let counter = 0;
  return {
    cloneRepo: jest.fn(),
    configIdentity: jest.fn(),
    fetchAndCheckoutBranch: jest.fn(),
    checkoutNewBranch: jest.fn(),
    pushBranch: jest.fn(),
    headSha: jest.fn(() => `sha-${++counter}`),
  };
});
jest.mock("../create-spec/changes", () => ({
  summariseProposal: jest.fn(() => "Implements the feature for issue."),
}));
jest.mock("./verify", () => ({
  verifyImplWorkdir: jest.fn(() => ({ ok: true })),
}));

import { handleCreateImpl } from "./index.js";
import {
  cloneRepo,
  fetchAndCheckoutBranch,
  checkoutNewBranch,
  headSha,
  pushBranch,
} from "../create-spec/git.js";
import { assertSkillPresent } from "../create-spec/preconditions.js";
import { verifyImplWorkdir } from "./verify.js";

const buildOctokit = (specBody = "") => ({
  issues: {
    createComment: jest.fn().mockResolvedValue({}),
    addLabels: jest.fn().mockResolvedValue({}),
  },
  pulls: {
    get: jest.fn().mockResolvedValue({
      data: {
        body: specBody,
        head: { ref: "chore/10-add-csv-export" },
        merged: false,
        state: "open",
      },
    }),
    create: jest.fn().mockResolvedValue({
      data: { number: 99, html_url: "https://github.com/o/r/pull/99" },
    }),
  },
});

const sequentialOpts = (overrides: Partial<any> = {}) => ({
  owner: "o",
  repo: "r",
  mode: "sequential" as const,
  specPrNumber: 12,
  octokit: buildOctokit(
    `Summary.\n\n<!-- openspec-flow:auto-maintained\nissue: 10\nkind: spec\nchange: add-csv-export\n-->`,
  ),
  gitPushToken: "token",
  log: { info: jest.fn(), warn: jest.fn() },
  runner: jest.fn().mockResolvedValue("done"),
  ...overrides,
});

const chainedOpts = (overrides: Partial<any> = {}) => ({
  owner: "o",
  repo: "r",
  mode: "chained" as const,
  specPrNumber: 12,
  specBranch: "chore/10-add-csv-export",
  changeName: "add-csv-export",
  issueNumber: 10,
  issueTitle: "Add CSV export",
  octokit: buildOctokit(),
  gitPushToken: "token",
  log: { info: jest.fn(), warn: jest.fn() },
  runner: jest.fn().mockResolvedValue("done"),
  ...overrides,
});

describe("handleCreateImpl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyImplWorkdir as jest.Mock).mockReturnValue({ ok: true });
  });

  describe("sequential mode", () => {
    it("parses spec PR metadata, clones, runs agent, opens impl PR on main", async () => {
      const opts = sequentialOpts();

      const result = await handleCreateImpl(opts);

      expect(result?.prNumber).toBe(99);
      expect(opts.octokit.pulls.get).toHaveBeenCalledWith(
        expect.objectContaining({ pull_number: 12 }),
      );
      expect(cloneRepo).toHaveBeenCalled();
      expect(fetchAndCheckoutBranch).not.toHaveBeenCalled();
      expect(opts.runner).toHaveBeenCalledTimes(1);
      expect(checkoutNewBranch).toHaveBeenCalledWith(
        "/tmp/openspec-flow/impl-test-wd",
        "feat/10-add-csv-export",
      );
      const prArgs = opts.octokit.pulls.create.mock.calls[0][0];
      expect(prArgs.base).toBe("main");
      expect(prArgs.head).toBe("feat/10-add-csv-export");
      expect(prArgs.body).toContain("kind: impl");
      expect(prArgs.body).toContain("spec-pr: 12");
      expect(prArgs.body).toContain("change: add-csv-export");
      expect(opts.octokit.issues.addLabels).toHaveBeenCalledWith(
        expect.objectContaining({ labels: ["openspec:impl"] }),
      );
      expect(opts.octokit.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          issue_number: 10,
          body: "impl PR opened: #99",
        }),
      );
    });

    it("aborts and posts failure when spec PR body has no metadata block", async () => {
      const opts = sequentialOpts({ octokit: buildOctokit("no metadata") });

      await expect(handleCreateImpl(opts)).rejects.toThrow("no openspec-flow metadata block");
      expect(opts.runner).not.toHaveBeenCalled();
    });
  });

  describe("chained mode", () => {
    it("checks out spec branch, opens impl PR stacked on it", async () => {
      const opts = chainedOpts();

      const result = await handleCreateImpl(opts);

      expect(result?.prNumber).toBe(99);
      expect(opts.octokit.pulls.get).not.toHaveBeenCalled();
      expect(fetchAndCheckoutBranch).toHaveBeenCalledWith(
        "/tmp/openspec-flow/impl-test-wd",
        "chore/10-add-csv-export",
      );
      const prArgs = opts.octokit.pulls.create.mock.calls[0][0];
      expect(prArgs.base).toBe("chore/10-add-csv-export");
      expect(prArgs.head).toBe("feat/10-add-csv-export");
    });
  });

  describe("verification + failure", () => {
    it("aborts when agent didn't commit (HEAD unchanged)", async () => {
      (headSha as jest.Mock).mockReturnValueOnce("same-sha").mockReturnValueOnce("same-sha");
      const opts = chainedOpts();

      await expect(handleCreateImpl(opts)).rejects.toThrow(
        "agent didn't commit any changes",
      );
      expect(pushBranch).not.toHaveBeenCalled();
      expect(opts.octokit.pulls.create).not.toHaveBeenCalled();
    });

    it("aborts when verifyImplWorkdir fails (e.g. agent forgot archive)", async () => {
      (verifyImplWorkdir as jest.Mock).mockReturnValueOnce({
        ok: false,
        reason: "change directory still exists",
      });
      const opts = chainedOpts();

      await expect(handleCreateImpl(opts)).rejects.toThrow("change directory still exists");
      expect(pushBranch).not.toHaveBeenCalled();
      expect(opts.octokit.pulls.create).not.toHaveBeenCalled();
      expect(opts.octokit.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining("❌ openspec-flow couldn't open an impl PR"),
        }),
      );
    });

    it("posts failure comment when preconditions fail", async () => {
      (assertSkillPresent as jest.Mock).mockImplementationOnce(() => {
        throw new Error("openspec-new-change skill not found in target repo");
      });
      const opts = chainedOpts();

      await expect(handleCreateImpl(opts)).rejects.toThrow("openspec-new-change skill");
      expect(opts.runner).not.toHaveBeenCalled();
      expect(opts.octokit.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.stringContaining("openspec-new-change skill") }),
      );
    });

    it("posts failure on both issue and impl PR when error occurs after PR opens", async () => {
      // Simulate: PR opens fine, but addLabels throws.
      const opts = chainedOpts();
      opts.octokit.issues.addLabels.mockRejectedValueOnce(new Error("forbidden"));

      await expect(handleCreateImpl(opts)).rejects.toThrow("forbidden");

      const commentBodies = opts.octokit.issues.createComment.mock.calls.map(
        (c: any) => c[0],
      );
      const issueTargets = commentBodies.filter((b: any) => b.issue_number === 10);
      const implPrTargets = commentBodies.filter((b: any) => b.issue_number === 99);
      expect(issueTargets.length).toBeGreaterThan(0);
      expect(implPrTargets.length).toBeGreaterThan(0);
    });
  });
});
