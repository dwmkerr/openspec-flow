import {
  renderLifecycleSticky,
  parseStateFromBody,
  stickyMarkerFor,
  type LifecycleStickyState,
} from "./lifecycle-sticky";

const REPO = { owner: "o", name: "r" };

describe("renderLifecycleSticky", () => {
  it("pre-gate preparing renders the GIF and a single descriptive headline", () => {
    const out = renderLifecycleSticky(42, {
      repo: REPO,
      spec: { kind: "preparing" },
      implementation: { kind: "not-started" },
    });
    expect(out).toContain("preparing to create the specification");
    expect(out).toContain("alt=\"working\"");
    expect(out).toContain("| Specification | preparing |");
    expect(out).toContain("| Implementation | not started |");
  });

  it("creating-with-run inlines the workflow link in the row, not the headline", () => {
    const out = renderLifecycleSticky(42, {
      repo: REPO,
      spec: {
        kind: "creating",
        run: { number: 234, url: "https://example/r/234" },
      },
      implementation: { kind: "not-started" },
    });
    expect(out).toContain("is creating the specification");
    expect(out).toContain("workflow [#234](https://example/r/234)");
    // Headline doesn't carry the link anymore.
    expect(out.match(/is creating the specification\.\s*\n/)).not.toBeNull();
  });

  it("PR awaiting review uses explicit URL links for the PR ref", () => {
    const out = renderLifecycleSticky(42, {
      repo: REPO,
      spec: { kind: "pr-open", prNumber: 137 },
      implementation: { kind: "not-started" },
    });
    expect(out).toContain("[#137](https://github.com/o/r/pull/137)");
    expect(out).toContain("Merge it to trigger the implementation");
    expect(out).toContain("`openspec:go`");
  });

  it("implementation awaiting review tells the user to merge to close the issue", () => {
    const out = renderLifecycleSticky(42, {
      repo: REPO,
      spec: { kind: "pr-merged", prNumber: 137 },
      implementation: { kind: "pr-open", prNumber: 138 },
    });
    expect(out).toContain("Merge it to close this issue");
  });

  it("failure renders the warning sigil and recovery instruction", () => {
    const out = renderLifecycleSticky(42, {
      repo: REPO,
      spec: { kind: "pr-merged", prNumber: 137 },
      implementation: { kind: "failed" },
      failure: {
        phase: "implementation",
        reason: "git push rejected",
        run: { number: 23, url: "https://example/r/23" },
      },
    });
    expect(out).toContain("⚠️ Run failed during implementation");
    expect(out).toContain("git push rejected");
    expect(out).toContain("Add the `openspec:go` label to retry");
  });

  it("completed reads as a single word, no GIF, no instruction", () => {
    const out = renderLifecycleSticky(42, {
      repo: REPO,
      spec: { kind: "pr-merged", prNumber: 137 },
      implementation: { kind: "pr-merged", prNumber: 138 },
    });
    expect(out).toContain("Completed.");
    expect(out).not.toContain("alt=\"working\"");
  });

  it("footer is right-aligned <sub> with both links", () => {
    const out = renderLifecycleSticky(42, {
      repo: REPO,
      spec: { kind: "not-started" },
      implementation: { kind: "not-started" },
    });
    expect(out).toContain('<div align="right"><sub>');
    expect(out).toContain("openspec-flow</a>");
    expect(out).toContain("docs</a>");
  });

  it("renders both the lookup marker and the state marker", () => {
    const state: LifecycleStickyState = {
      repo: REPO,
      spec: { kind: "pr-merged", prNumber: 137 },
      implementation: { kind: "pr-open", prNumber: 138 },
    };
    const out = renderLifecycleSticky(42, state);
    expect(out).toContain(stickyMarkerFor(42));
    expect(out).toContain("openspec-flow:sticky-state ");
  });
});

describe("parseStateFromBody", () => {
  it("round-trips state via the embedded marker", () => {
    const state: LifecycleStickyState = {
      repo: REPO,
      spec: { kind: "pr-merged", prNumber: 137 },
      implementation: {
        kind: "pr-iterating",
        prNumber: 138,
        run: { number: 251, url: "https://example/r/251" },
      },
    };
    const out = renderLifecycleSticky(42, state);
    const parsed = parseStateFromBody(out);
    expect(parsed).toEqual(state);
  });

  it("returns null when no state marker is present", () => {
    expect(parseStateFromBody("just a regular comment")).toBeNull();
  });
});
