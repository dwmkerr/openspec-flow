import { parseSpecPrMetadata } from "./spec-pr-metadata.js";

const block = (fields: Record<string, string>): string => {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n");
  return `<!-- openspec-flow:auto-maintained — do not remove or edit\n${lines}\n-->`;
};

describe("parseSpecPrMetadata", () => {
  it("returns issue + change for a well-formed spec block", () => {
    const body = `Summary text.\n\nRefs #42.\n\n${block({ issue: "42", kind: "spec", change: "add-csv-export" })}\n`;
    expect(parseSpecPrMetadata(body)).toEqual({
      issue: 42,
      change: "add-csv-export",
      kind: "spec",
    });
  });

  it("returns null when the block is absent", () => {
    expect(parseSpecPrMetadata("No metadata here.")).toBeNull();
  });

  it("returns null on body that is null or undefined", () => {
    expect(parseSpecPrMetadata(null)).toBeNull();
    expect(parseSpecPrMetadata(undefined)).toBeNull();
  });

  it("returns null when kind is not spec (e.g. impl block on impl PR)", () => {
    const body = block({ issue: "10", kind: "impl", change: "foo", "spec-pr": "5" });
    expect(parseSpecPrMetadata(body)).toBeNull();
  });

  it("returns null when issue field is missing or non-numeric", () => {
    expect(parseSpecPrMetadata(block({ kind: "spec", change: "x" }))).toBeNull();
    expect(parseSpecPrMetadata(block({ issue: "abc", kind: "spec", change: "x" }))).toBeNull();
  });

  it("returns null when change field is missing", () => {
    expect(parseSpecPrMetadata(block({ issue: "1", kind: "spec" }))).toBeNull();
  });

  it("tolerates extra whitespace and field reordering", () => {
    const body = `<!--   openspec-flow:auto-maintained    \n  change:   foo  \n  kind:  spec  \n  issue:   7  \n-->`;
    expect(parseSpecPrMetadata(body)).toEqual({ issue: 7, change: "foo", kind: "spec" });
  });
});
