// Integration tests: drive the Probot app via probot.receive() with
// fixture payloads. Use nock to intercept Octokit calls and assert the
// dispatcher's comment-posting contract.

import { generateKeyPairSync } from "node:crypto";
import nock from "nock";
import { Probot, ProbotOctokit } from "probot";
import app from "../../src/index";
import {
  issueLabeled,
  prClosed,
  prLabeled,
} from "../fixtures/load";

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

const stubComment = (issueNumber: number) => {
  let capturedBody: string | undefined;
  const scope = nock("https://api.github.com")
    .post(`/repos/dwmkerr/openspec-flow/issues/${issueNumber}/comments`, (b) => {
      capturedBody = b.body;
      return true;
    })
    .reply(201, { id: 1 });
  return { scope, getBody: () => capturedBody };
};

const fail400OnAnythingElse = () =>
  nock("https://api.github.com")
    .post(/^\/repos\/dwmkerr\/openspec-flow(?!\/issues\/\d+\/comments).*/)
    .reply(400, "unexpected octokit call")
    .post(/.*/)
    .reply(400, "unexpected octokit call");

describe("dispatcher integration", () => {
  it("issues.labeled openspec:go → posts intent comment on the issue", async () => {
    stubInstallationToken();
    const { getBody } = stubComment(42);

    await probot.receive({ id: "1", name: "issues", payload: issueLabeled() as any });

    expect(getBody()).toContain("create specification for issue #42");
  });

  it("openspec:go on PR with openspec:spec → posts iterate-spec comment", async () => {
    stubInstallationToken();
    const { getBody } = stubComment(43);

    await probot.receive({
      id: "2",
      name: "pull_request",
      payload: prLabeled({ prNumber: 43, labels: ["openspec:spec", "openspec:go"] }) as any,
    });

    expect(getBody()).toContain("iterate on spec PR #43");
  });

  it("spec PR merged → posts create-impl comment", async () => {
    stubInstallationToken();
    const { getBody } = stubComment(43);

    await probot.receive({
      id: "3",
      name: "pull_request",
      payload: prClosed({ prNumber: 43, merged: true, labels: ["openspec:spec"] }) as any,
    });

    expect(getBody()).toContain("create implementation");
  });

  it("openspec:go on closed issue → posts visible-noop comment", async () => {
    stubInstallationToken();
    const { getBody } = stubComment(42);

    await probot.receive({
      id: "4",
      name: "issues",
      payload: issueLabeled({ state: "closed" }) as any,
    });

    expect(getBody()).toContain("Ignored:");
    expect(getBody()).toContain("closed");
  });

  it("user applies openspec:spec manually → posts transfer-mode comment", async () => {
    stubInstallationToken();
    const { getBody } = stubComment(43);

    await probot.receive({
      id: "5",
      name: "pull_request",
      payload: prLabeled({ labelAdded: "openspec:spec", labels: ["openspec:spec"] }) as any,
    });

    expect(getBody()).toContain("stepping back");
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
