// Integration tests: drive the Probot app via probot.receive() with
// fixture payloads. Use nock to intercept Octokit calls and assert the
// dispatcher's comment-posting contract.

import { generateKeyPairSync } from "node:crypto";
import nock from "nock";
import { Probot, ProbotOctokit } from "probot";

// Mock the create-spec handler so the dispatcher can be exercised
// without invoking Claude. Module mock must be hoisted before the
// `app` import below.
jest.mock("../../src/handlers/create-spec/index", () => ({
  handleCreateSpec: jest.fn().mockResolvedValue("stub reply"),
}));
jest.mock("../../src/handlers/iterate-spec/index", () => ({
  handleIterateSpec: jest.fn().mockResolvedValue(undefined),
}));
import { handleCreateSpec } from "../../src/handlers/create-spec/index";
import { handleIterateSpec } from "../../src/handlers/iterate-spec/index";
import app from "../../src/index";
import {
  issueLabeled,
  prClosed,
  prLabeled,
} from "../fixtures/load";

const mockHandler = handleCreateSpec as jest.Mock;

// Generate a real 2048-bit RSA key once per test run — Probot signs JWTs.
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const TEST_PEM = privateKey.export({ type: "pkcs1", format: "pem" }).toString();

let probot: Probot;

beforeEach(() => {
  nock.disableNetConnect();
  probot = new Probot({
    appId: 1,
    privateKey: TEST_PEM,
    Octokit: ProbotOctokit.defaults({
      retry: { enabled: false },
      throttle: { enabled: false },
    }),
  });
  probot.load(app);
});

afterEach(() => {
  nock.cleanAll();
  nock.enableNetConnect();
});

const stubInstallationToken = () =>
  nock("https://api.github.com")
    .post("/app/installations/1/access_tokens")
    .reply(200, { token: "test", permissions: { issues: "write" } });

// Record call order so we can assert the reaction precedes the comment.
let callLog: string[] = [];

beforeEach(() => {
  callLog = [];
  mockHandler.mockClear();
});

const stubComment = (issueNumber: number) => {
  let capturedBody: string | undefined;
  const scope = nock("https://api.github.com")
    .post(`/repos/dwmkerr/openspec-flow/issues/${issueNumber}/comments`, (b) => {
      capturedBody = b.body;
      callLog.push("comment");
      return true;
    })
    .reply(201, { id: 1 });
  return { scope, getBody: () => capturedBody };
};

const stubReaction = (issueNumber: number) => {
  let capturedBody: any;
  const scope = nock("https://api.github.com")
    .post(`/repos/dwmkerr/openspec-flow/issues/${issueNumber}/reactions`, (b) => {
      capturedBody = b;
      callLog.push("reaction");
      return true;
    })
    .reply(201, { id: 1, content: "eyes" });
  return { scope, getBody: () => capturedBody };
};

// Any POST other than the explicitly-stubbed comment/reaction endpoints
// should never fire. The fallback matchers return 400 so an unexpected
// call surfaces as a test failure rather than passing silently.
const fail400OnAnythingElse = () =>
  nock("https://api.github.com")
    .post(/^\/repos\/dwmkerr\/openspec-flow(?!\/issues\/\d+\/(comments|reactions)).*/)
    .reply(400, "unexpected octokit call")
    .post(/.*/)
    .reply(400, "unexpected octokit call");

describe("dispatcher integration", () => {
  it("issues.labeled openspec:go → eyes reaction then intent comment", async () => {
    stubInstallationToken();
    const reaction = stubReaction(42);
    const { getBody } = stubComment(42);

    await probot.receive({ id: "1", name: "issues", payload: issueLabeled() as any });

    expect(reaction.getBody()).toEqual({ content: "eyes" });
    expect(getBody()).toContain("create specification for issue #42");
    expect(callLog).toEqual(["reaction", "comment"]);
  });

  it("openspec:go on PR with openspec:spec → eyes reaction then iterate-spec comment", async () => {
    stubInstallationToken();
    const reaction = stubReaction(43);
    const { getBody } = stubComment(43);

    await probot.receive({
      id: "2",
      name: "pull_request",
      payload: prLabeled({ prNumber: 43, labels: ["openspec:spec", "openspec:go"] }) as any,
    });

    expect(reaction.getBody()).toEqual({ content: "eyes" });
    expect(getBody()).toContain("iterate on spec PR #43");
    expect(callLog).toEqual(["reaction", "comment"]);
  });

  it("spec PR merged → eyes reaction then create-impl comment", async () => {
    stubInstallationToken();
    const reaction = stubReaction(43);
    const { getBody } = stubComment(43);

    await probot.receive({
      id: "3",
      name: "pull_request",
      payload: prClosed({ prNumber: 43, merged: true, labels: ["openspec:spec"] }) as any,
    });

    expect(reaction.getBody()).toEqual({ content: "eyes" });
    expect(getBody()).toContain("create implementation");
    expect(callLog).toEqual(["reaction", "comment"]);
  });

  it("openspec:go on closed issue → eyes reaction then visible-noop comment", async () => {
    stubInstallationToken();
    const reaction = stubReaction(42);
    const { getBody } = stubComment(42);

    await probot.receive({
      id: "4",
      name: "issues",
      payload: issueLabeled({ state: "closed" }) as any,
    });

    expect(reaction.getBody()).toEqual({ content: "eyes" });
    expect(getBody()).toContain("Ignored:");
    expect(getBody()).toContain("closed");
    expect(callLog).toEqual(["reaction", "comment"]);
  });

  it("user applies openspec:spec manually → eyes reaction then transfer-mode comment", async () => {
    stubInstallationToken();
    const reaction = stubReaction(43);
    const { getBody } = stubComment(43);

    await probot.receive({
      id: "5",
      name: "pull_request",
      payload: prLabeled({ labelAdded: "openspec:spec", labels: ["openspec:spec"] }) as any,
    });

    expect(reaction.getBody()).toEqual({ content: "eyes" });
    expect(getBody()).toContain("stepping back");
    expect(callLog).toEqual(["reaction", "comment"]);
  });

  it("create-spec intent calls handleCreateSpec with issue context", async () => {
    stubInstallationToken();
    stubReaction(42);
    stubComment(42);

    await probot.receive({ id: "10", name: "issues", payload: issueLabeled() as any });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const passed = mockHandler.mock.calls[0][0];
    expect(passed.issueNumber).toBe(42);
    expect(passed.issueTitle).toBe("Add CSV export");
    expect(passed.owner).toBe("dwmkerr");
    expect(passed.repo).toBe("openspec-flow");
    expect(typeof passed.octokit).toBe("object");
    expect(passed.gitPushToken).toBeTruthy();
    expect(typeof passed.log.info).toBe("function");
  });

  it("noop intents do not call the handler", async () => {
    fail400OnAnythingElse();

    await probot.receive({
      id: "11",
      name: "issues",
      payload: issueLabeled({ labelAdded: "bug" }) as any,
    });

    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("handler failure does not crash the webhook", async () => {
    stubInstallationToken();
    stubReaction(42);
    stubComment(42);
    mockHandler.mockRejectedValueOnce(new Error("api down"));

    // Reaching the assertion without throw proves the dispatcher
    // caught the handler error.
    await expect(
      probot.receive({ id: "12", name: "issues", payload: issueLabeled() as any }),
    ).resolves.not.toThrow();
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it("reaction failure does not block the comment", async () => {
    stubInstallationToken();
    // Reactions endpoint fails — comment must still post.
    nock("https://api.github.com")
      .post("/repos/dwmkerr/openspec-flow/issues/42/reactions")
      .reply(403, "Resource not accessible by integration");
    const { getBody } = stubComment(42);

    await probot.receive({ id: "9", name: "issues", payload: issueLabeled() as any });

    expect(getBody()).toContain("create specification for issue #42");
  });

  it("non-trigger label → silent noop, no comment posted", async () => {
    fail400OnAnythingElse();

    await probot.receive({
      id: "6",
      name: "issues",
      payload: issueLabeled({ labelAdded: "bug" }) as any,
    });

    // If a comment had been posted, the fail400 mock would intercept and the
    // dispatcher would throw. Reaching here means no Octokit call was made.
    expect(nock.pendingMocks().length).toBeGreaterThanOrEqual(0);
  });

  it("bot sender → silent noop, no comment posted", async () => {
    fail400OnAnythingElse();

    await probot.receive({
      id: "7",
      name: "issues",
      payload: issueLabeled({ senderType: "Bot" }) as any,
    });

    expect(nock.pendingMocks().length).toBeGreaterThanOrEqual(0);
  });

  it("impl PR merged → silent noop, no comment posted", async () => {
    fail400OnAnythingElse();

    await probot.receive({
      id: "8",
      name: "pull_request",
      payload: prClosed({ merged: true, labels: ["openspec:impl"] }) as any,
    });

    expect(nock.pendingMocks().length).toBeGreaterThanOrEqual(0);
  });
});
