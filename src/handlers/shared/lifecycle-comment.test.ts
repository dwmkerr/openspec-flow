import {
  renderLifecycle,
  upsertLifecycleComment,
  LIFECYCLE_MARKER,
} from "./lifecycle-comment.js";

describe("renderLifecycle", () => {
  it("spec-opened ticks only the first item + carries the marker", () => {
    const body = renderLifecycle({ phase: "spec-opened", specPr: 61 });
    expect(body).toContain("✅ spec PR opened — #61");
    expect(body).toContain("▢ spec PR merged");
    expect(body).toContain("▢ impl PR opened");
    expect(body).toContain(LIFECYCLE_MARKER);
  });

  it("impl-opened ticks through impl PR opened", () => {
    const body = renderLifecycle({ phase: "impl-opened", specPr: 61, implPr: 62 });
    expect(body).toContain("✅ spec PR opened — #61");
    expect(body).toContain("✅ spec PR merged");
    expect(body).toContain("✅ impl PR opened — #62");
    expect(body).toContain("▢ implemented & merged");
  });

  it("impl-merged ticks all + notes issue closed", () => {
    const body = renderLifecycle({ phase: "impl-merged", specPr: 61, implPr: 62 });
    expect(body).toContain("✅ implemented & merged — #62 (issue closed)");
    expect(body).not.toContain("▢");
  });
});

describe("upsertLifecycleComment", () => {
  const make = (comments: Array<{ id: number; body?: string }>) => {
    const calls: Array<{ route: string; params: any }> = [];
    const octokit = {
      request: jest.fn(async (route: string, params: any) => {
        calls.push({ route, params });
        if (route.startsWith("GET")) return { data: comments };
        return { data: { id: 999 } };
      }),
    };
    return { octokit, calls };
  };

  it("creates a new comment when none carries the marker", async () => {
    const { octokit, calls } = make([{ id: 1, body: "unrelated" }]);
    await upsertLifecycleComment(octokit as any, "o", "r", 59, { phase: "spec-opened", specPr: 61 });
    const post = calls.find((c) => c.route.startsWith("POST"));
    expect(post).toBeDefined();
    expect(post!.params.issue_number).toBe(59);
  });

  it("edits the existing marked comment in place", async () => {
    const { octokit, calls } = make([{ id: 7, body: `old\n${LIFECYCLE_MARKER}` }]);
    await upsertLifecycleComment(octokit as any, "o", "r", 59, { phase: "impl-merged", implPr: 62 });
    const patch = calls.find((c) => c.route.startsWith("PATCH"));
    expect(patch).toBeDefined();
    expect(patch!.params.comment_id).toBe(7);
    expect(calls.find((c) => c.route.startsWith("POST"))).toBeUndefined();
  });

  it("never throws when the request fails", async () => {
    const octokit = { request: jest.fn(async () => { throw new Error("boom"); }) };
    const warn = jest.fn();
    await expect(
      upsertLifecycleComment(octokit as any, "o", "r", 59, { phase: "spec-opened" }, { warn }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
