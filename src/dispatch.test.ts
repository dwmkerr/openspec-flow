// Tests for the shared dispatch core. The registry is mocked so these
// tests assert the core's sequencing (eyes, sticky comment, visible-noop
// terminal, lazy token, null-handler surface) without touching handlers.

jest.mock("./handlers/registry", () => ({
  dispatchTo: jest.fn(),
}));
jest.mock("./handlers/shared/status-comment", () => ({
  createStatusComment: jest.fn(async () => 4242),
  updateStatusComment: jest.fn(async () => {}),
}));

import { runDispatch } from "./dispatch.js";
import { dispatchTo } from "./handlers/registry.js";
import {
  createStatusComment,
  updateStatusComment,
} from "./handlers/shared/status-comment.js";
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
  it("visible noop is terminal: posts comment, no token, no dispatch", async () => {
    const deps = makeDeps();
    const intent: Intent = { kind: "noop", visible: true, reason: "closed PR" };

    await runDispatch(intent, deps);

    expect(createStatusComment).toHaveBeenCalledTimes(1);
    expect(deps.getToken).not.toHaveBeenCalled();
    expect(dispatchTo).not.toHaveBeenCalled();
  });

  it("actionable intent: eyes, comment, token, registry dispatch", async () => {
    (dispatchTo as jest.Mock).mockResolvedValue({ dispatched: true });
    const deps = makeDeps();
    const intent: Intent = { kind: "create-spec", issueNumber: 7, title: "t" };

    await runDispatch(intent, deps);

    expect(deps.octokit.reactions.createForIssue).toHaveBeenCalledTimes(1);
    expect(deps.getToken).toHaveBeenCalledTimes(1);
    expect(dispatchTo).toHaveBeenCalledTimes(1);
    const ctx = (dispatchTo as jest.Mock).mock.calls[0][1];
    expect(ctx.gitPushToken).toBe("tok");
    expect(ctx.statusCommentId).toBe(4242);
    expect(ctx.statusTargetNumber).toBe(7);
  });

  it("null handler surfaces a visible failure on the sticky comment", async () => {
    (dispatchTo as jest.Mock).mockResolvedValue({
      dispatched: false,
      kind: "iterate-impl",
    });
    const deps = makeDeps();
    const intent: Intent = { kind: "iterate-impl", prNumber: 9 };

    await runDispatch(intent, deps);

    expect(updateStatusComment).toHaveBeenCalledTimes(1);
    const body = (updateStatusComment as jest.Mock).mock.calls[0][4];
    expect(body).toContain("iterate-impl");
    expect(body).toContain("not implemented");
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

    expect(deps.octokit.reactions.listForIssue).toHaveBeenCalledTimes(1);
    expect(deps.octokit.reactions.deleteForIssue).toHaveBeenCalledTimes(2);
  });

  it("failure path still clears eyes via finally", async () => {
    (dispatchTo as jest.Mock).mockRejectedValue(new Error("boom"));
    const deps = makeDeps({ logError: jest.fn() });
    deps.octokit.reactions.listForIssue = jest.fn(async () => ({
      data: [{ id: 99 }],
    }));
    const intent: Intent = { kind: "create-spec", issueNumber: 7, title: "t" };

    await runDispatch(intent, deps);

    expect(deps.octokit.reactions.deleteForIssue).toHaveBeenCalledWith(
      expect.objectContaining({ reaction_id: 99 }),
    );
  });
});
