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
  // Raw request() handles status comment PATCHes.
  request: jest.fn().mockResolvedValue({ data: {} }),
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
  statusCommentId: 555,
  statusTargetNumber: 10,
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
  statusCommentId: 555,
  statusTargetNumber: 10,
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
      // Terminal status PATCHed; no separate "impl PR opened" comment.
      const patchCalls = opts.octokit.request.mock.calls.filter(
        (c: any) => c[0].startsWith("PATCH /repos/"),
      );
      const finalPatch = patchCalls[patchCalls.length - 1];
      expect(finalPatch[1].comment_id).toBe(555);
      expect(finalPatch[1].body).toBe("✅ impl PR opened: #99");
      expect(opts.octokit.issues.createComment).not.toHaveBeenCalled();
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
      const patchCalls = opts.octokit.request.mock.calls.filter(
        (c: any) => c[0].startsWith("PATCH /repos/"),
      );
      expect(patchCalls[patchCalls.length - 1][1].body).toContain("change directory still exists");
    });

    it("posts failure comment when preconditions fail", async () => {
      (assertSkillPresent as jest.Mock).mockImplementationOnce(() => {
        throw new Error("openspec-new-change skill not found in target repo");
      });
      const opts = chainedOpts();

      await expect(handleCreateImpl(opts)).rejects.toThrow("openspec-new-change skill");
      expect(opts.runner).not.toHaveBeenCalled();
      const patchCalls = opts.octokit.request.mock.calls.filter(
        (c: any) => c[0].startsWith("PATCH /repos/"),
      );
      expect(patchCalls[patchCalls.length - 1][1].body).toContain("openspec-new-change skill");
    });

    it("posts failure on the status comment AND the impl PR when error occurs after PR opens", async () => {
      // Simulate: PR opens fine, but addLabels throws.
      const opts = chainedOpts();
      opts.octokit.issues.addLabels.mockRejectedValueOnce(new Error("forbidden"));

      await expect(handleCreateImpl(opts)).rejects.toThrow("forbidden");

      // Status comment got the failure body.
      const patchCalls = opts.octokit.request.mock.calls.filter(
        (c: any) => c[0].startsWith("PATCH /repos/"),
      );
      expect(patchCalls[patchCalls.length - 1][1].body).toContain("forbidden");
      // Impl PR also got a comment (newly-opened PR's own reviewer
      // wouldn't see the status comment on the originating issue).
      const implPrTargets = opts.octokit.issues.createComment.mock.calls
        .map((c: any) => c[0])
        .filter((b: any) => b.issue_number === 99);
      expect(implPrTargets.length).toBeGreaterThan(0);
    });
  });
});

describe("handleCreateImpl — issue lifecycle", () => {
  it("advances the lifecycle to impl-opened on the originating issue", async () => {
    const octokit = {
      issues: { createComment: jest.fn().mockResolvedValue({}), addLabels: jest.fn().mockResolvedValue({}) },
      request: jest.fn(async (route: string) =>
        route.startsWith("GET") ? { data: [] } : { data: { id: 1 } },
      ),
      pulls: {
        get: jest.fn().mockResolvedValue({
          data: {
            body: `Summary.\n\n<!-- openspec-flow:auto-maintained\nissue: 10\nkind: spec\nchange: add-csv-export\n-->`,
            head: { ref: "chore/10-add-csv-export" },
            merged: false,
            state: "open",
          },
        }),
        create: jest.fn().mockResolvedValue({
          data: { number: 99, html_url: "https://github.com/o/r/pull/99" },
        }),
      },
    };
    await handleCreateImpl({
      owner: "o",
      repo: "r",
      mode: "sequential" as const,
      specPrNumber: 12,
      octokit: octokit as any,
      gitPushToken: "token",
      log: { info: jest.fn(), warn: jest.fn() },
      runner: jest.fn().mockResolvedValue("done"),
      statusCommentId: 555,
      statusTargetNumber: 10,
    } as any);

    const post = octokit.request.mock.calls.find(
      (c: any) => c[0].startsWith("POST") && String(c[1].body).includes("openspec-flow:sticky issue="),
    );
    expect(post).toBeDefined();
    expect(post[1].issue_number).toBe(10);
    // Sticky now reflects Spec merged + Implementation PR open.
    expect(post[1].body).toContain("PR [#12]");
    expect(post[1].body).toContain("- merged");
    expect(post[1].body).toContain("PR [#99]");
    expect(post[1].body).toContain("- open");
  });
});
