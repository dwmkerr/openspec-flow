import { PassThrough, Writable } from "node:stream";
import { writeCsv, __testing } from "./csv.js";

const collect = async (rows: Iterable<ReadonlyArray<string | number>>, header: ReadonlyArray<string>): Promise<Buffer> => {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (c: Buffer) => chunks.push(c));
  const ended = new Promise<void>((r) => stream.on("end", r));
  await writeCsv(stream, { header }, rows);
  stream.end();
  await ended;
  return Buffer.concat(chunks);
};

describe("csv writer", () => {
  it("emits UTF-8 BOM as first three bytes", async () => {
    const out = await collect([["v"]], ["h"]);
    expect(out.subarray(0, 3)).toEqual(__testing.UTF8_BOM);
  });

  it("terminates every record with CRLF", async () => {
    const out = (await collect([["a"], ["b"]], ["h"])).subarray(3).toString("utf8");
    expect(out).toBe("h\r\na\r\nb\r\n");
  });

  it("quotes fields containing comma", async () => {
    const out = (await collect([["a,b"]], ["h"])).subarray(3).toString("utf8");
    expect(out).toBe('h\r\n"a,b"\r\n');
  });

  it("quotes fields containing CR or LF", async () => {
    const out = (await collect([["line1\nline2"], ["c\rd"]], ["h"])).subarray(3).toString("utf8");
    expect(out).toBe('h\r\n"line1\nline2"\r\n"c\rd"\r\n');
  });

  it("escapes embedded double quotes by doubling and wraps in quotes", async () => {
    const out = (await collect([['say "hi"']], ["h"])).subarray(3).toString("utf8");
    expect(out).toBe('h\r\n"say ""hi"""\r\n');
  });

  it("neutralizes CSV-injection prefixes =, +, -, @", async () => {
    const out = (await collect(
      [["=SUM(A1)"], ["+1"], ["-2"], ["@cmd"]],
      ["h"],
    )).subarray(3).toString("utf8");
    expect(out).toBe("h\r\n'=SUM(A1)\r\n'+1\r\n'-2\r\n'@cmd\r\n");
  });

  it("does not quote plain ASCII fields", async () => {
    expect(__testing.escapeField("hello")).toBe("hello");
    expect(__testing.escapeField(42)).toBe("42");
  });

  it("respects writable back-pressure", async () => {
    // Custom Writable that delays its callback to force write() to return
    // false and drive the writer through its drain-wait path.
    let drainWaits = 0;
    const stream = new Writable({
      highWaterMark: 16,
      write(_chunk, _enc, cb) {
        // Defer to next tick so the buffer reports `false` from write().
        setImmediate(cb);
      },
    });
    stream.on("drain", () => { drainWaits++; });
    const many = (function* () {
      for (let i = 0; i < 50; i++) yield [`row-${i}-with-some-padding`];
    })();
    await writeCsv(stream, { header: ["h"] }, many);
    stream.end();
    expect(drainWaits).toBeGreaterThan(0);
  });
});
