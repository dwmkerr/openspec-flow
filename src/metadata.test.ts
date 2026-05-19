import { parse, serialize } from "./metadata";

describe("metadata serialize", () => {
  it("emits an HTML comment block with the required fields", () => {
    const out = serialize({ issue: 42, kind: "spec", change: "add-csv-export" });
    expect(out).toContain("<!-- openspec-flow:auto-maintained");
    expect(out).toContain("issue: 42");
    expect(out).toContain("kind: spec");
    expect(out).toContain("change: add-csv-export");
    expect(out).toMatch(/-->\s*$/);
  });

  it("includes spec-pr only on impl PRs", () => {
    const spec = serialize({ issue: 42, kind: "spec", change: "x" });
    expect(spec).not.toContain("spec-pr");

    const impl = serialize({ issue: 42, kind: "impl", change: "x", specPr: 43 });
    expect(impl).toContain("spec-pr: 43");
  });
});

describe("metadata parse", () => {
  it("round-trips serialize output", () => {
    const meta = { issue: 42, kind: "impl" as const, change: "add-csv-export", specPr: 43 };
    expect(parse(serialize(meta))).toEqual(meta);
  });

  it("returns null on missing block", () => {
    expect(parse("no metadata here")).toBeNull();
    expect(parse("")).toBeNull();
    expect(parse(null)).toBeNull();
    expect(parse(undefined)).toBeNull();
  });

  it("returns null if required fields are missing", () => {
    const malformed =
      "<!-- openspec-flow:auto-maintained\nissue: 42\n-->"; // missing kind, change
    expect(parse(malformed)).toBeNull();
  });

  it("returns null if kind is not spec or impl", () => {
    const wrongKind =
      "<!-- openspec-flow:auto-maintained\nissue: 42\nkind: bogus\nchange: x\n-->";
    expect(parse(wrongKind)).toBeNull();
  });

  it("tolerates surrounding markdown body", () => {
    const body = `## Summary

something something

<!-- openspec-flow:auto-maintained — do not remove or edit
issue: 7
kind: spec
change: my-change
-->
`;
    expect(parse(body)).toEqual({ issue: 7, kind: "spec", change: "my-change" });
  });

  it("uses the LAST block when multiple are present", () => {
    const body = `<!-- openspec-flow:auto-maintained
issue: 1
kind: spec
change: old
-->
later edited content

<!-- openspec-flow:auto-maintained
issue: 9
kind: impl
change: new
spec-pr: 8
-->`;
    expect(parse(body)).toEqual({
      issue: 9,
      kind: "impl",
      change: "new",
      specPr: 8,
    });
  });
});
