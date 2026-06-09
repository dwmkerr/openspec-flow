// Unit tests for iterate-impl. Mirrors iterate-spec: mock workdir +
// git + runner + verify. Operates on an impl PR (kind: impl metadata),
// and the verify step blocks spec/workflow mutations.

jest.mock("../create-spec/workdir", () => ({
  createWorkdir: jest.fn(() => "/tmp/openspec-flow/iterate-impl-wd"),
  removeWorkdir: jest.fn(),
}));
jest.mock("../create-spec/git", () => {
  let counter = 0;
  return {
    cloneRepo: jest.fn(),
    configIdentity: jest.fn(),
    fetchAndCheckoutBranch: jest.fn(),
    pushBranch: jest.fn(),
    headSha: jest.fn(() => `sha-${++counter}`),
  };
});
jest.mock("./verify", () => ({
  verifyIterateImplWorkdir: jest.fn(() => ({ ok: true })),
}));

import { handleIterateImpl } from "./index.js";
import { cloneRepo, fetchAndCheckoutBranch, headSha, pushBranch } from "../create-spec/git.js";
import { verifyIterateImplWorkdir } from "./verify.js";

const implBodyWithMeta = `Implementation.

Closes #59.

<!-- openspec-flow:auto-maintained
issue: 59
kind: impl
change: add-ls-alias
spec-pr: 61
-->`;

const buildOctokit = (o: { body?: string | null; state?: string } = {}) => ({
  issues: { createComment: jest.fn().mockResolvedValue({}), addLabels: jest.fn().mockResolvedValue({}) },
  request: jest.fn(async (route: string) => route.startsWith("GET") ? { data: [] } : { data: { id: 1 } }),
  pulls: {
    get: jest.fn().mockResolvedValue({
      data: {
        body: o.body ?? implBodyWithMeta,
        head: { ref: "feat/59-add-ls-alias" },
        merged: false,
        state: o.state ?? "open",
      },
    }),
    create: jest.fn(),
  },
});

const baseOpts = (overrides: Partial<any> = {}) => ({
  owner: "o",
  repo: "r",
  implPrNumber: 62,
  octokit: buildOctokit(),
  gitPushToken: "token",
  log: { info: jest.fn(), warn: jest.fn() },
  runner: jest.fn().mockResolvedValue("ok"),
  statusCommentId: 555,
  statusTargetNumber: 62,
  ...overrides,
});

describe("handleIterateImpl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyIterateImplWorkdir as jest.Mock).mockReturnValue({ ok: true });
  });

  it("happy path: checks out the impl branch, runs agent, pushes, marks updated", async () => {
    const opts = baseOpts();
    await handleIterateImpl(opts);

    expect(cloneRepo).toHaveBeenCalled();
    expect(fetchAndCheckoutBranch).toHaveBeenCalledWith(
      "/tmp/openspec-flow/iterate-impl-wd",
      "feat/59-add-ls-alias",
    );
    expect(opts.runner).toHaveBeenCalledTimes(1);
    expect(pushBranch).toHaveBeenCalledWith("/tmp/openspec-flow/iterate-impl-wd", "feat/59-add-ls-alias");
    // Lifecycle sticky write — Implementation row flips back to pr-open.
    const writes = opts.octokit.request.mock.calls
      .filter((c: any) => c[0].startsWith("POST") || c[0].startsWith("PATCH"))
      .map((c: any) => c[1]);
    expect(writes.length).toBeGreaterThan(0);
    const finalWrite = writes[writes.length - 1];
    expect(finalWrite.body).toContain("- open");
  });

  it("prompt forbids spec/openspec mutations + frames the impl scope", async () => {
    const opts = baseOpts();
    await handleIterateImpl(opts);
    const prompt = opts.runner.mock.calls[0][0].prompt;
    expect(prompt).toContain("openspec/changes/");
    expect(prompt).toContain("openspec/specs/");
    expect(prompt).toContain("#62");
    expect(prompt).not.toContain("{{");
  });

  it("aborts when the impl PR is closed", async () => {
    const opts = baseOpts({ octokit: buildOctokit({ state: "closed" }) });
    await expect(handleIterateImpl(opts)).rejects.toThrow("PR is closed");
    expect(opts.runner).not.toHaveBeenCalled();
  });

  it("aborts when the impl PR body has no metadata block", async () => {
    const opts = baseOpts({ octokit: buildOctokit({ body: "no metadata" }) });
    await expect(handleIterateImpl(opts)).rejects.toThrow("no openspec-flow impl metadata block");
    expect(opts.runner).not.toHaveBeenCalled();
  });

  it("aborts when the agent didn't commit (HEAD unchanged)", async () => {
    (headSha as jest.Mock).mockReturnValueOnce("same").mockReturnValueOnce("same");
    const opts = baseOpts();
    await expect(handleIterateImpl(opts)).rejects.toThrow("agent didn't commit any changes");
    expect(pushBranch).not.toHaveBeenCalled();
  });

  it("aborts when verify rejects a forbidden mutation", async () => {
    (verifyIterateImplWorkdir as jest.Mock).mockReturnValueOnce({
      ok: false,
      reason: "iterate-impl must not modify spec artefacts",
    });
    const opts = baseOpts();
    await expect(handleIterateImpl(opts)).rejects.toThrow("must not modify spec artefacts");
    expect(pushBranch).not.toHaveBeenCalled();
  });
});
