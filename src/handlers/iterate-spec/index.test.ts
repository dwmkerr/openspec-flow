// Unit tests for iterate-spec. Same mock-everything pattern as the
// other handlers. Reuses helpers from create-spec via jest.mock of
// those modules.

jest.mock("../create-spec/workdir", () => ({
  createWorkdir: jest.fn(() => "/tmp/openspec-flow/iterate-test-wd"),
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
    pushBranch: jest.fn(),
    headSha: jest.fn(() => `sha-${++counter}`),
  };
});
jest.mock("./verify", () => ({
  verifyIterateWorkdir: jest.fn(() => ({ ok: true })),
}));

import { handleIterateSpec } from "./index.js";
import {
  cloneRepo,
  fetchAndCheckoutBranch,
  headSha,
  pushBranch,
} from "../create-spec/git.js";
import { assertSkillPresent } from "../create-spec/preconditions.js";
import { verifyIterateWorkdir } from "./verify.js";

const specBodyWithMeta = `Summary.

<!-- openspec-flow:auto-maintained
issue: 26
kind: spec
change: rfc-shim
-->`;

const buildOctokit = (opts: { body?: string | null; state?: string } = {}) => ({
  issues: {
    createComment: jest.fn().mockResolvedValue({}),
    addLabels: jest.fn().mockResolvedValue({}),
  },
  request: jest.fn(async (route: string) => route.startsWith("GET") ? { data: [] } : { data: { id: 1 } }),
  pulls: {
    get: jest.fn().mockResolvedValue({
      data: {
        body: opts.body ?? specBodyWithMeta,
        head: { ref: "chore/26-rfc-shim" },
        merged: false,
        state: opts.state ?? "open",
      },
    }),
    create: jest.fn(),
  },
});

const baseOpts = (overrides: Partial<any> = {}) => ({
  owner: "o",
  repo: "r",
  specPrNumber: 27,
  octokit: buildOctokit(),
  gitPushToken: "token",
  log: { info: jest.fn(), warn: jest.fn() },
  runner: jest.fn().mockResolvedValue("ok"),
  statusCommentId: 555,
  statusTargetNumber: 27,
  ...overrides,
});

describe("handleIterateSpec", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyIterateWorkdir as jest.Mock).mockReturnValue({ ok: true });
  });

  it("happy path: fetches PR, checks out branch, runs agent, pushes, comments", async () => {
    const opts = baseOpts();

    await handleIterateSpec(opts);

    expect(cloneRepo).toHaveBeenCalled();
    expect(fetchAndCheckoutBranch).toHaveBeenCalledWith(
      "/tmp/openspec-flow/iterate-test-wd",
      "chore/26-rfc-shim",
    );
    expect(opts.runner).toHaveBeenCalledTimes(1);
    expect(pushBranch).toHaveBeenCalledWith(
      "/tmp/openspec-flow/iterate-test-wd",
      "chore/26-rfc-shim",
    );
    // Lifecycle sticky was written via the issue-comments endpoint.
    // After iteration completes, the spec row flips back to pr-open.
    const writes = opts.octokit.request.mock.calls
      .filter((c: any) => c[0].startsWith("POST") || c[0].startsWith("PATCH"))
      .map((c: any) => c[1]);
    expect(writes.length).toBeGreaterThan(0);
    const finalWrite = writes[writes.length - 1];
    expect(finalWrite.body).toContain("- open");
  });

  it("interpolates change context into the prompt", async () => {
    const opts = baseOpts();

    await handleIterateSpec(opts);

    const prompt = opts.runner.mock.calls[0][0].prompt;
    expect(prompt).toContain("rfc-shim");
    expect(prompt).toContain("#27");
    expect(prompt).toContain("#26");
    expect(prompt).toContain("chore/26-rfc-shim");
    expect(prompt).not.toContain("{{");
  });

  it("prompt frames gh as the tool with example commands + lists feedback surfaces", async () => {
    const opts = baseOpts();

    await handleIterateSpec(opts);

    const prompt = opts.runner.mock.calls[0][0].prompt;
    expect(prompt).toMatch(/gh.*as needed/i);
    expect(prompt).toMatch(/examples/i);
    // Surfaces named in the prompt
    expect(prompt).toContain("originating issue");
    expect(prompt).toContain("inline review comments");
    expect(prompt).toContain("reviews");
    // Bot self-comments to be ignored
    expect(prompt).toContain("openspec-flow[bot]");
  });

  it("aborts when the spec PR is closed", async () => {
    const opts = baseOpts({
      octokit: buildOctokit({ state: "closed" }),
    });

    await expect(handleIterateSpec(opts)).rejects.toThrow("PR is closed");
    expect(opts.runner).not.toHaveBeenCalled();
    // No sticky write — failure happened before metadata resolution,
    // so the handler doesn't know the originating issue yet.
  });

  it("aborts when the spec PR body has no metadata block", async () => {
    const opts = baseOpts({
      octokit: buildOctokit({ body: "no metadata at all" }),
    });

    await expect(handleIterateSpec(opts)).rejects.toThrow("no openspec-flow metadata block");
    expect(opts.runner).not.toHaveBeenCalled();
  });

  it("aborts when agent didn't commit (HEAD unchanged)", async () => {
    (headSha as jest.Mock).mockReturnValueOnce("same-sha").mockReturnValueOnce("same-sha");
    const opts = baseOpts();

    await expect(handleIterateSpec(opts)).rejects.toThrow(
      "agent didn't commit any changes",
    );
    expect(pushBranch).not.toHaveBeenCalled();
  });

  it("aborts when verify fails (e.g. agent accidentally archived)", async () => {
    (verifyIterateWorkdir as jest.Mock).mockReturnValueOnce({
      ok: false,
      reason: "change directory no longer exists",
    });
    const opts = baseOpts();

    await expect(handleIterateSpec(opts)).rejects.toThrow("change directory no longer exists");
    expect(pushBranch).not.toHaveBeenCalled();
    const writes = opts.octokit.request.mock.calls
      .filter((c: any) => c[0].startsWith("POST") || c[0].startsWith("PATCH"))
      .map((c: any) => c[1]);
    expect(writes.some((p: any) => String(p.body).includes("change directory no longer exists"))).toBe(true);
  });

  it("posts failure comment when preconditions fail", async () => {
    (assertSkillPresent as jest.Mock).mockImplementationOnce(() => {
      throw new Error("openspec-new-change skill not found in target repo");
    });
    const opts = baseOpts();

    await expect(handleIterateSpec(opts)).rejects.toThrow("openspec-new-change skill");
    expect(opts.runner).not.toHaveBeenCalled();
    const writes = opts.octokit.request.mock.calls
      .filter((c: any) => c[0].startsWith("POST") || c[0].startsWith("PATCH"))
      .map((c: any) => c[1]);
    expect(writes.some((p: any) => String(p.body).includes("openspec-new-change skill"))).toBe(true);
  });

  it("posts failure comment when agent throws", async () => {
    const opts = baseOpts({
      runner: jest.fn().mockRejectedValue(new Error("api down")),
    });

    await expect(handleIterateSpec(opts)).rejects.toThrow("api down");
    const writes = opts.octokit.request.mock.calls
      .filter((c: any) => c[0].startsWith("POST") || c[0].startsWith("PATCH"))
      .map((c: any) => c[1]);
    expect(writes.some((p: any) => String(p.body).includes("api down"))).toBe(true);
  });
});
