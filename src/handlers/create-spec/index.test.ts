import { handleCreateSpec } from "./index.js";

describe("handleCreateSpec stub", () => {
  it("interpolates issue number + title into the prompt and calls runner", async () => {
    const log = { info: jest.fn(), warn: jest.fn() };
    const runner = jest.fn().mockResolvedValue("• plan\n• plan\n• plan");

    const result = await handleCreateSpec({
      issueNumber: 42,
      issueTitle: "Add CSV export",
      log,
      runner: runner as any,
    });

    expect(result).toBe("• plan\n• plan\n• plan");
    expect(runner).toHaveBeenCalledTimes(1);
    const passed = runner.mock.calls[0][0];
    expect(passed.prompt).toContain("#42");
    expect(passed.prompt).toContain("Add CSV export");
    // No unresolved placeholders left behind.
    expect(passed.prompt).not.toContain("{{");
  });

  it("logs start + done markers around the agent call", async () => {
    const log = { info: jest.fn(), warn: jest.fn() };
    const runner = jest.fn().mockResolvedValue("ok");

    await handleCreateSpec({
      issueNumber: 7,
      issueTitle: "x",
      log,
      runner: runner as any,
    });

    const lines = log.info.mock.calls.map((c) => c[0]);
    expect(lines[0]).toMatch(/starting for issue #7/);
    expect(lines[lines.length - 1]).toMatch(/done \(2 chars\)/);
  });

  it("propagates errors from the runner", async () => {
    const log = { info: jest.fn(), warn: jest.fn() };
    const runner = jest.fn().mockRejectedValue(new Error("api down"));

    await expect(
      handleCreateSpec({ issueNumber: 1, issueTitle: "x", log, runner: runner as any }),
    ).rejects.toThrow("api down");
  });
});
