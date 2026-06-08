// Tests for the shared dispatch core. The registry is mocked so these
// tests assert the core's sequencing (eyes, visible-noop terminal,
// lazy token, null-handler surface, failure propagation) without
// touching handlers.
//
// The per-target sticky-status was removed; handlers now mutate the
// lifecycle sticky directly. So dispatch's statusCommentId is always
// undefined and there's no sticky-status mock to wire here.

jest.mock("./handlers/registry", () => ({
  dispatchTo: jest.fn(),
}));

import { runDispatch } from "./dispatch.js";
import { dispatchTo } from "./handlers/registry.js";
import type { Intent } from "./intent.js";

const makeOctokit = () => ({
  reactions: {
    createForIssue: jest.fn(async () => ({})),
    listForIssue: jest.fn(async () => ({ data: [] })),
    deleteForIssue: jest.fn(async () => ({})),
  },
});

const makeDeps = (over: Partial<Parameters<typeof runDispatch>[1]> = {}) => ({
  octokit: makeOctokit() as any,
  owner: "dwmkerr",
  repo: "x",
  targetNumber: 7,
  log: { info: jest.fn(), warn: jest.fn() },
  getToken: jest.fn(async () => "tok"),
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("runDispatch", () => {
  it("visible noop is terminal: no token, no dispatch", async () => {
    const deps = makeDeps();
    const intent: Intent = { kind: "noop", visible: true, reason: "closed PR" };

    const result = await runDispatch(intent, deps);

    expect(result.ok).toBe(true);
    expect(deps.getToken).not.toHaveBeenCalled();
    expect(dispatchTo).not.toHaveBeenCalled();
  });

  it("actionable intent: eyes added, token resolved, dispatch invoked", async () => {
    (dispatchTo as jest.Mock).mockResolvedValue({ dispatched: true });
    const deps = makeDeps();
    const intent: Intent = { kind: "iterate-spec", prNumber: 7 };

    const result = await runDispatch(intent, deps);

    expect(result.ok).toBe(true);
    expect(deps.octokit.reactions.createForIssue).toHaveBeenCalledTimes(1);
    expect(deps.getToken).toHaveBeenCalledTimes(1);
    expect(dispatchTo).toHaveBeenCalledTimes(1);
    const ctx = (dispatchTo as jest.Mock).mock.calls[0][1];
    expect(ctx.gitPushToken).toBe("tok");
    // No per-target sticky any more; handlers mutate the lifecycle
    // sticky directly. statusCommentId is always undefined.
    expect(ctx.statusCommentId).toBeUndefined();
    expect(ctx.statusTargetNumber).toBe(7);
  });

  it("null handler surfaces ok=false with a named error", async () => {
    (dispatchTo as jest.Mock).mockResolvedValue({
      dispatched: false,
      kind: "iterate-impl",
    });
    const deps = makeDeps();
    const intent: Intent = { kind: "iterate-impl", prNumber: 9 };

    const result = await runDispatch(intent, deps);
    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain("iterate-impl");
    expect(result.error?.message).toContain("not implemented");
  });

  it("handler error routes to logError and returns ok=false with the error", async () => {
    (dispatchTo as jest.Mock).mockRejectedValue(new Error("boom"));
    const logError = jest.fn();
    const deps = makeDeps({ logError });
    const intent: Intent = { kind: "create-spec", issueNumber: 7, title: "t" };

    const result = await runDispatch(intent, deps);
    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe("boom");
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][1].message).toBe("boom");
  });

  it("happy path lists+deletes eyes reactions at the end", async () => {
    (dispatchTo as jest.Mock).mockResolvedValue({ dispatched: true });
    const deps = makeDeps();
    deps.octokit.reactions.listForIssue = jest.fn(async () => ({
      data: [{ id: 11 }, { id: 12 }],
    }));
    const intent: Intent = { kind: "create-spec", issueNumber: 7, title: "t" };

    await runDispatch(intent, deps);

    expect(deps.octokit.reactions.listForIssue).toHaveBeenCalled();
    expect(deps.octokit.reactions.deleteForIssue).toHaveBeenCalledTimes(2);
  });
});
