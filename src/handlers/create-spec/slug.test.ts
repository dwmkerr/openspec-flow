import { branchSlug, branchName } from "./slug.js";

describe("branchSlug", () => {
  it("lowercases + replaces non-alphanumeric runs with hyphens", () => {
    expect(branchSlug("Add CSV export — RFC 4180")).toBe("add-csv-export-rfc-4180");
  });

  it("trims leading and trailing hyphens", () => {
    expect(branchSlug("---hello---")).toBe("hello");
  });

  it("collapses runs of separators into a single hyphen", () => {
    expect(branchSlug("foo   bar / baz")).toBe("foo-bar-baz");
  });

  it("truncates to the max length without leaving a trailing hyphen", () => {
    const title = "a".repeat(60) + " end";
    const out = branchSlug(title, 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith("-")).toBe(false);
  });

  it("falls back to 'untitled' when nothing alphanumeric remains", () => {
    expect(branchSlug("---")).toBe("untitled");
  });
});

describe("branchName", () => {
  it("combines issue number with slug under chore/ prefix", () => {
    expect(branchName(10, "Add CSV export")).toBe("chore/10-add-csv-export");
  });
});
