import { stickyMarker, upsertStickyComment } from "./sticky-status";

const noopLog = { warn: jest.fn() };

const makeOcto = (listData: any[] = []) => ({
  request: jest.fn(async (route: string, params: any) => {
    if (route.startsWith("GET ")) return { data: listData };
    if (route.startsWith("PATCH ")) return { data: { id: params.comment_id } };
    if (route.startsWith("POST ")) return { data: { id: 123 } };
    return { data: {} };
  }),
});

describe("stickyMarker", () => {
  it("encodes intent + target into a unique marker", () => {
    expect(stickyMarker("create-spec", 42)).toBe(
      "<!-- openspec-flow:sticky intent=create-spec target=42 -->",
    );
    expect(stickyMarker("iterate-spec", 43)).toBe(
      "<!-- openspec-flow:sticky intent=iterate-spec target=43 -->",
    );
  });
});

describe("upsertStickyComment", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates on first call", async () => {
    const octokit = makeOcto();
    const result = await upsertStickyComment(
      octokit as any,
      "o",
      "r",
      42,
      "create-spec",
      "openspec-flow received: create spec for #42",
      noopLog,
    );
    expect(result.created).toBe(true);
    expect(result.commentId).toBe(123);
    const post = (octokit.request as jest.Mock).mock.calls.find((c) =>
      c[0].startsWith("POST "),
    );
    expect(post[1].body).toContain(stickyMarker("create-spec", 42));
  });

  it("patches when bot has already posted the sticky", async () => {
    const existing = `prior body\n\n${stickyMarker("create-spec", 42)}`;
    const octokit = makeOcto([{ id: 555, body: existing }]);
    const result = await upsertStickyComment(
      octokit as any,
      "o",
      "r",
      42,
      "create-spec",
      "updated state",
      noopLog,
    );
    expect(result.created).toBe(false);
    expect(result.commentId).toBe(555);
    const patch = (octokit.request as jest.Mock).mock.calls.find((c) =>
      c[0].startsWith("PATCH "),
    );
    expect(patch[1].comment_id).toBe(555);
  });

  it("each (intent, target) pair gets its own marker — same target, different intent → different comment", async () => {
    const existing = [
      {
        id: 555,
        body: `noise\n\n${stickyMarker("create-spec", 42)}`,
      },
    ];
    const octokit = makeOcto(existing);
    const result = await upsertStickyComment(
      octokit as any,
      "o",
      "r",
      42,
      "iterate-spec",
      "different intent",
      noopLog,
    );
    expect(result.created).toBe(true);
  });
});
