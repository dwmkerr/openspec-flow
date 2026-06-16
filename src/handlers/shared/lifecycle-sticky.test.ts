import {
  renderLifecycleSticky,
  parseStateFromBody,
  stickyMarkerFor,
  type LifecycleStickyState,
} from "./lifecycle-sticky";

const REPO = { owner: "o", name: "r" };
const issueOpts = (appInstalled = true) => ({
  issueNumber: 42,
  audience: "issue" as const,
  appInstalled,
});
const prOpts = (appInstalled = true) => ({
  issueNumber: 42,
  audience: "pr" as const,
  appInstalled,
});

describe("renderLifecycleSticky", () => {
  it("pre-gate preparing renders the GIF and a single descriptive headline", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: { kind: "preparing" },
        implementation: { kind: "not-started" },
      },
      issueOpts(),
    );
    expect(out).toContain("preparing to create the specification");
    expect(out).toContain("alt=\"working\"");
    expect(out).toContain("| Specification | preparing |");
    expect(out).toContain("| Implementation | not started |");
  });

  it("creating-with-run inlines the workflow link in the row, not the headline", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: {
          kind: "creating",
          run: { number: 234, url: "https://example/r/234" },
        },
        implementation: { kind: "not-started" },
      },
      issueOpts(),
    );
    expect(out).toContain("is creating the specification");
    expect(out).toContain("workflow [#234](https://example/r/234)");
    expect(out.match(/is creating the specification\.\s*\n/)).not.toBeNull();
  });

  it("creating with step inlines sub-state in the row", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: {
          kind: "creating",
          run: { number: 234, url: "https://example/r/234" },
          step: "gathering context",
        },
        implementation: { kind: "not-started" },
      },
      issueOpts(),
    );
    expect(out).toContain("creating - gathering context in workflow [#234]");
  });

  it("PR awaiting review uses explicit URL links for the PR ref", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: { kind: "pr-open", prNumber: 137 },
        implementation: { kind: "not-started" },
      },
      issueOpts(),
    );
    expect(out).toContain("[#137](https://github.com/o/r/pull/137)");
    expect(out).toContain("Merge it to trigger the implementation");
  });

  it("implementation awaiting review tells the user to merge to close the issue", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: { kind: "pr-merged", prNumber: 137 },
        implementation: { kind: "pr-open", prNumber: 138 },
      },
      issueOpts(),
    );
    expect(out).toContain("Merge it to close this issue");
  });

  it("failure renders the warning sigil and recovery instruction", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: { kind: "pr-merged", prNumber: 137 },
        implementation: { kind: "failed" },
        failure: {
          phase: "implementation",
          reason: "git push rejected",
          run: { number: 23, url: "https://example/r/23" },
        },
      },
      issueOpts(),
    );
    expect(out).toContain("⚠️ Run failed during implementation");
    expect(out).toContain("git push rejected");
    expect(out).toContain("Add the `openspec:go` label to retry");
  });

  it("completed reads as a single word, no GIF, no instruction", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: { kind: "pr-merged", prNumber: 137 },
        implementation: { kind: "pr-merged", prNumber: 138 },
      },
      issueOpts(),
    );
    expect(out).toContain("Completed.");
    expect(out).not.toContain("alt=\"working\"");
  });

  it("footer is right-aligned <sub> with repo, docs, and sponsor links", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: { kind: "not-started" },
        implementation: { kind: "not-started" },
      },
      issueOpts(),
    );
    expect(out).toContain('<div align="right"><sub>');
    expect(out).toContain("openspec-flow</a>");
    expect(out).toContain("docs</a>");
    expect(out).toContain("https://github.com/sponsors/dwmkerr");
    expect(out).toContain("sponsoring</a>");
    expect(out).toMatch(/costs a little each month/i);
  });

  it("PR audience prepends a 'Tracked on issue' link header", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: { kind: "creating", run: { number: 234, url: "https://example/r/234" } },
        implementation: { kind: "not-started" },
      },
      prOpts(),
      137,
    );
    expect(out).toContain("Tracked on issue [#42](https://github.com/o/r/issues/42)");
  });

  it("App-not-installed adds an install hint below the table", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: { kind: "preparing" },
        implementation: { kind: "not-started" },
      },
      issueOpts(false),
    );
    expect(out).toContain("Install the [openspec-flow App]");
  });

  it("App-installed renders no install hint", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: { kind: "preparing" },
        implementation: { kind: "not-started" },
      },
      issueOpts(true),
    );
    expect(out).not.toContain("Install the [openspec-flow App]");
  });

  it("renders both the lookup marker and the state marker", () => {
    const state: LifecycleStickyState = {
      repo: REPO,
      spec: { kind: "pr-merged", prNumber: 137 },
      implementation: { kind: "pr-open", prNumber: 138 },
    };
    const out = renderLifecycleSticky(state, issueOpts());
    expect(out).toContain(stickyMarkerFor(42));
    expect(out).toContain("openspec-flow:sticky-state ");
  });

  it("PR variant uses a per-PR lookup marker distinct from the issue marker", () => {
    const out = renderLifecycleSticky(
      {
        repo: REPO,
        spec: { kind: "pr-open", prNumber: 137 },
        implementation: { kind: "not-started" },
      },
      prOpts(),
      137,
    );
    expect(out).toContain("openspec-flow:sticky pr=137 issue=42");
    expect(out).not.toContain(stickyMarkerFor(42));
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
        step: "implementing the change",
      },
    };
    const out = renderLifecycleSticky(state, issueOpts());
    const parsed = parseStateFromBody(out);
    expect(parsed).toEqual(state);
  });

  it("returns null when no state marker is present", () => {
    expect(parseStateFromBody("just a regular comment")).toBeNull();
  });
});
