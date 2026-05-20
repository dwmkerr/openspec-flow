import { formatChunkPreview } from "./format-chunk.js";

// Strip ANSI so assertions stay readable. chalk colours work in tty
// output; tests assert on the structural shape, not the colour codes.
const plain = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("formatChunkPreview", () => {
  it("formats system init with session id prefix", () => {
    const line = formatChunkPreview({
      type: "system",
      subtype: "init",
      session_id: "abcdefgh1234567890",
    } as any);
    expect(plain(line)).toMatch(/^system:init session=abcdefgh\.\.\./);
  });

  it("formats result success with truncated reply", () => {
    const line = formatChunkPreview({
      type: "result",
      subtype: "success",
      result: "hello there",
    } as any);
    expect(plain(line)).toBe('result:success "hello there"');
  });

  it("formats result error subtype with errors list", () => {
    const line = formatChunkPreview({
      type: "result",
      subtype: "error_during_execution",
      errors: ["boom"],
    } as any);
    expect(plain(line)).toBe("result:error_during_execution boom");
  });

  it("formats assistant text", () => {
    const line = formatChunkPreview({
      type: "assistant",
      message: { content: [{ type: "text", text: "I will read the file." }] },
    } as any);
    expect(plain(line)).toBe('assistant: "I will read the file."');
  });

  it("formats assistant tool_use with name + params preview", () => {
    const line = formatChunkPreview({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "Bash", input: { cmd: "ls" } }],
      },
    } as any);
    expect(plain(line)).toBe('assistant: Bash {"cmd":"ls"}');
  });

  it("formats user tool_result string content", () => {
    const line = formatChunkPreview({
      type: "user",
      message: {
        content: [{ type: "tool_result", content: "file listing here" }],
      },
    } as any);
    expect(plain(line)).toBe('user: tool_result "file listing here"');
  });

  it("formats user tool_result array content", () => {
    const line = formatChunkPreview({
      type: "user",
      message: {
        content: [
          { type: "tool_result", content: [{ type: "text", text: "ok output" }] },
        ],
      },
    } as any);
    expect(plain(line)).toBe('user: tool_result "ok output"');
  });

  it("falls back to (empty) when no content blocks", () => {
    const line = formatChunkPreview({ type: "assistant", message: { content: [] } } as any);
    expect(plain(line)).toBe("assistant: (empty)");
  });

  it("truncates long text with ellipsis", () => {
    const long = "x".repeat(500);
    const line = formatChunkPreview({
      type: "assistant",
      message: { content: [{ type: "text", text: long }] },
    } as any, 0, 60);
    expect(plain(line)).toMatch(/\.\.\."$/);
    expect(plain(line).length).toBeLessThan(70);
  });
});
