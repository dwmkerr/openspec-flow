import { upsertCommentByMarker } from "./comment-upsert";

const makeOcto = (overrides: any = {}) => ({
  request: jest.fn(async (route: string, _params: any) => {
    if (route.startsWith("GET ")) return { data: overrides.list ?? [] };
    if (route.startsWith("PATCH ")) return { data: { id: 999 } };
    if (route.startsWith("POST ")) return { data: { id: 123 } };
    return { data: {} };
  }),
});

const MARKER =
  "<!-- openspec-flow:issue-breadcrumb intent=create-impl issue=42 spec-pr=43 -->";

describe("upsertCommentByMarker", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates a comment when no marker match exists", async () => {
    const octokit = makeOcto({ list: [{ id: 1, body: "unrelated" }] });
    const result = await upsertCommentByMarker(
      octokit as any,
      "o",
      "r",
      42,
      MARKER,
      "hello",
    );
    expect(result.created).toBe(true);
    expect(result.commentId).toBe(123);
    const postCall = (octokit.request as jest.Mock).mock.calls.find((c) => c[0].startsWith("POST "));
    expect(postCall[1].body).toContain(MARKER);
  });

  it("patches when a comment with the marker already exists", async () => {
    const octokit = makeOcto({
      list: [
        { id: 1, body: "noise" },
        { id: 555, body: `prior\n\n${MARKER}` },
      ],
    });
    const result = await upsertCommentByMarker(
      octokit as any,
      "o",
      "r",
      42,
      MARKER,
      "updated body",
    );
    expect(result.created).toBe(false);
    expect(result.commentId).toBe(555);
    const patchCall = (octokit.request as jest.Mock).mock.calls.find((c) => c[0].startsWith("PATCH "));
    expect(patchCall[1].comment_id).toBe(555);
    expect(patchCall[1].body).toContain(MARKER);
  });

  it("auto-appends marker when caller forgot it", async () => {
    const octokit = makeOcto();
    await upsertCommentByMarker(octokit as any, "o", "r", 42, MARKER, "no marker here");
    const postCall = (octokit.request as jest.Mock).mock.calls.find((c) => c[0].startsWith("POST "));
    expect(postCall[1].body).toContain(MARKER);
  });

  it("returns null commentId on list failure", async () => {
    const octokit = {
      request: jest.fn(async (route: string) => {
        if (route.startsWith("GET ")) throw new Error("rate limit");
        return { data: {} };
      }),
    };
    const result = await upsertCommentByMarker(
      octokit as any,
      "o",
      "r",
      42,
      MARKER,
      "x",
    );
    expect(result.commentId).toBeNull();
    expect(result.created).toBe(false);
  });
});
