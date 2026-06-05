import { addEyes, removeEyes } from "./reactions";

const noopLog = { warn: jest.fn() };

const makeOcto = (overrides: any = {}) => ({
  reactions: {
    createForIssue: jest.fn().mockResolvedValue({}),
    listForIssue: jest.fn().mockResolvedValue({ data: [] }),
    deleteForIssue: jest.fn().mockResolvedValue({}),
    ...(overrides.reactions ?? {}),
  },
});

describe("addEyes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("posts a single createForIssue call", async () => {
    const o = makeOcto();
    await addEyes(o, "o", "r", 42, noopLog);
    expect(o.reactions.createForIssue).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      issue_number: 42,
      content: "eyes",
    });
  });

  it("swallows errors and logs warn", async () => {
    const o = makeOcto({
      reactions: {
        createForIssue: jest.fn().mockRejectedValue(new Error("boom")),
      },
    });
    const log = { warn: jest.fn() };
    await expect(addEyes(o, "o", "r", 42, log)).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });
});

describe("removeEyes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deletes every eyes reaction returned by list", async () => {
    const o = makeOcto({
      reactions: {
        listForIssue: jest.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] }),
      },
    });
    await removeEyes(o, "o", "r", 42, noopLog);
    expect(o.reactions.deleteForIssue).toHaveBeenCalledTimes(2);
    expect(o.reactions.deleteForIssue).toHaveBeenCalledWith(
      expect.objectContaining({ reaction_id: 1 }),
    );
    expect(o.reactions.deleteForIssue).toHaveBeenCalledWith(
      expect.objectContaining({ reaction_id: 2 }),
    );
  });

  it("is a no-op when no eyes reactions exist", async () => {
    const o = makeOcto();
    await removeEyes(o, "o", "r", 42, noopLog);
    expect(o.reactions.deleteForIssue).not.toHaveBeenCalled();
  });

  it("swallows 404 on individual delete", async () => {
    const o = makeOcto({
      reactions: {
        listForIssue: jest.fn().mockResolvedValue({ data: [{ id: 1 }] }),
        deleteForIssue: jest.fn().mockRejectedValue({ status: 404 }),
      },
    });
    const log = { warn: jest.fn() };
    await expect(removeEyes(o, "o", "r", 42, log)).resolves.toBeUndefined();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("swallows list error", async () => {
    const o = makeOcto({
      reactions: {
        listForIssue: jest.fn().mockRejectedValue(new Error("rate-limit")),
      },
    });
    const log = { warn: jest.fn() };
    await expect(removeEyes(o, "o", "r", 42, log)).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("rate-limit"));
  });
});
