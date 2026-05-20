// RFC 4180 CSV writer that streams to a Node.js Writable.
//
// Streams row-by-row so callers can pipe arbitrarily large datasets without
// materializing them in memory. Emits a UTF-8 BOM first so Excel on Windows
// opens the file with the correct encoding. Neutralizes formula injection
// before quoting because spreadsheet apps evaluate any field whose first
// character is =, +, -, or @ as a formula.

import type { Writable } from "node:stream";

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const CRLF = "\r\n";
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@"]);

export type CsvRow = ReadonlyArray<string | number>;

export interface CsvWriterOptions {
  readonly header: CsvRow;
}

const needsQuoting = (s: string): boolean =>
  s.includes(",") || s.includes('"') || s.includes("\r") || s.includes("\n");

// Per OWASP CSV-injection guidance. Done before quoting so the leading
// apostrophe sits inside the quoted field rather than outside it.
const neutralizeFormula = (s: string): string => {
  if (s.length === 0) return s;
  return FORMULA_PREFIXES.has(s[0]) ? `'${s}` : s;
};

const escapeField = (raw: string | number): string => {
  const s = neutralizeFormula(String(raw));
  if (!needsQuoting(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
};

const encodeRow = (row: CsvRow): string =>
  row.map(escapeField).join(",") + CRLF;

// Drain back-pressure correctly: if write() returns false, wait for `drain`
// before writing the next row. Keeps memory bounded for very large exports.
const writeWithBackpressure = (stream: Writable, chunk: string | Buffer): Promise<void> =>
  new Promise((resolve, reject) => {
    const ok = stream.write(chunk, (err) => {
      if (err) reject(err);
    });
    if (ok) {
      resolve();
      return;
    }
    stream.once("drain", resolve);
  });

export async function writeCsv(
  stream: Writable,
  options: CsvWriterOptions,
  rows: AsyncIterable<CsvRow> | Iterable<CsvRow>,
): Promise<void> {
  await writeWithBackpressure(stream, UTF8_BOM);
  await writeWithBackpressure(stream, encodeRow(options.header));
  for await (const row of rows as AsyncIterable<CsvRow>) {
    await writeWithBackpressure(stream, encodeRow(row));
  }
}

// Exported for unit tests of pure encoding behaviour.
export const __testing = { encodeRow, escapeField, neutralizeFormula, UTF8_BOM };
