import { createStatusComment, updateStatusComment } from "./status-comment.js";

describe("status-comment helpers", () => {
  describe("createStatusComment", () => {
    it("POSTs to /issues/<n>/comments and returns the new id", async () => {
      const request = jest.fn().mockResolvedValue({ data: { id: 123 } });
      const octokit = { request } as any;

      const id = await createStatusComment(octokit, "o", "r", 42, "👀 hi");

      expect(id).toBe(123);
      expect(request).toHaveBeenCalledWith(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        expect.objectContaining({ owner: "o", repo: "r", issue_number: 42, body: "👀 hi" }),
      );
    });
  });

  describe("updateStatusComment", () => {
    it("PATCHes /issues/comments/<id>", async () => {
      const request = jest.fn().mockResolvedValue({ data: {} });
      const octokit = { request } as any;

      await updateStatusComment(octokit, "o", "r", 123, "✅ done");

      expect(request).toHaveBeenCalledWith(
        "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
        expect.objectContaining({ owner: "o", repo: "r", comment_id: 123, body: "✅ done" }),
      );
    });

    it("is a no-op when commentId is undefined (CLI mode)", async () => {
      const request = jest.fn();
      const octokit = { request } as any;

      await updateStatusComment(octokit, "o", "r", undefined, "ignored");

      expect(request).not.toHaveBeenCalled();
    });

    it("swallows transient failures and logs a warning", async () => {
      const request = jest.fn().mockRejectedValue(new Error("boom"));
      const warn = jest.fn();
      const octokit = { request } as any;

      await expect(
        updateStatusComment(octokit, "o", "r", 123, "won't land", { warn }),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("boom"));
    });
  });
});
