// Unit tests for finalize-impl. It resolves the issue from the impl-PR
// metadata and upserts the terminal lifecycle line — no clone, agent,
// or PR. octokit.request is mocked: GET comments → [] so the upsert
// takes the create path.

import { handleFinalizeImpl } from "./index.js";
import { LIFECYCLE_MARKER } from "../shared/lifecycle-comment.js";

const implBody = (extra = "") => `Implementation.

Closes #59.

<!-- openspec-flow:auto-maintained — do not remove or edit
issue: 59
kind: impl
change: add-ls-alias
spec-pr: 61
-->${extra}`;

const buildOctokit = (body: string | null) => {
  const request = jest.fn(async (route: string) =>
    route.startsWith("GET") ? { data: [] } : { data: { id: 1 } },
  );
  return {
    request,
    pulls: { get: jest.fn(async () => ({ data: { body, state: "closed", merged: true, head: { ref: "x" } } })) },
  };
};

const opts = (octokit: any) => ({
  owner: "o",
  repo: "r",
  implPrNumber: 62,
  octokit,
  gitPushToken: "tok",
  log: { info: jest.fn(), warn: jest.fn() },
});

beforeEach(() => jest.clearAllMocks());

describe("handleFinalizeImpl", () => {
  it("stamps the terminal lifecycle line on the originating issue", async () => {
    const octokit = buildOctokit(implBody());
    await handleFinalizeImpl(opts(octokit) as any);

    // The handler now double-writes: new lifecycle sticky AND the
    // legacy lifecycle breadcrumb. Look for the post that carries
    // the legacy marker specifically.
    const posts = octokit.request.mock.calls.filter((c: any[]) => c[0].startsWith("POST"));
    expect(posts.length).toBeGreaterThan(0);
    const legacyPost = posts.find((c: any[]) => c[1].body.includes(LIFECYCLE_MARKER));
    expect(legacyPost).toBeDefined();
    expect(legacyPost[1].issue_number).toBe(59);
    expect(legacyPost[1].body).toContain("✅ implemented & merged — #62 (issue closed)");
  });

  it("skips (no throw) when the impl PR has no metadata block", async () => {
    const octokit = buildOctokit("no metadata here");
    const o = opts(octokit);
    await expect(handleFinalizeImpl(o as any)).resolves.toBeUndefined();
    // No lifecycle write attempted.
    expect(octokit.request.mock.calls.some((c: any[]) => c[0].startsWith("POST"))).toBe(false);
    expect(o.log.warn).toHaveBeenCalled();
  });

  it("does not clone, run an agent, or open a PR", async () => {
    const octokit = buildOctokit(implBody());
    // pulls.create absent → if the handler tried to open a PR it would throw.
    await expect(handleFinalizeImpl(opts(octokit) as any)).resolves.toBeUndefined();
  });
});
