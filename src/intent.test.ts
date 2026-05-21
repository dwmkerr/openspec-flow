import { classify, describe as describeIntent } from "./intent";
import { issueLabeled, prClosed, prLabeled } from "../tests/fixtures/load";

describe("classify — positive intents", () => {
  it("issues.labeled with openspec:go on fresh issue → create-spec", () => {
    const intent = classify("issues", issueLabeled());
    expect(intent.kind).toBe("create-spec");
    if (intent.kind === "create-spec") {
      expect(intent.issueNumber).toBe(42);
      expect(intent.title).toBe("Add CSV export");
    }
  });

  it("pull_request.labeled with openspec:go on spec PR → iterate-spec", () => {
    const intent = classify(
      "pull_request",
      prLabeled({ prNumber: 43, labels: ["openspec:spec", "openspec:go"] }),
    );
    expect(intent.kind).toBe("iterate-spec");
    if (intent.kind === "iterate-spec") expect(intent.prNumber).toBe(43);
  });

  it("pull_request.labeled with openspec:go on impl PR → iterate-impl", () => {
    const intent = classify(
      "pull_request",
      prLabeled({ prNumber: 44, labels: ["openspec:impl", "openspec:go"] }),
    );
    expect(intent.kind).toBe("iterate-impl");
  });

  it("spec PR merged → create-impl with extracted issue number from Refs", () => {
    const intent = classify(
      "pull_request",
      prClosed({ prNumber: 43, merged: true, labels: ["openspec:spec"], body: "Refs #42." }),
    );
    expect(intent.kind).toBe("create-impl");
    if (intent.kind === "create-impl") {
      expect(intent.specPrNumber).toBe(43);
      expect(intent.issueNumber).toBe(42);
    }
  });

  // Legacy: in-flight spec PRs opened before the Refs switch still use
  // `Closes #N`. The classifier must keep accepting them.
  it("spec PR merged with legacy Closes body → create-impl with issue number", () => {
    const intent = classify(
      "pull_request",
      prClosed({ prNumber: 43, merged: true, labels: ["openspec:spec"], body: "Closes #42." }),
    );
    expect(intent.kind).toBe("create-impl");
    if (intent.kind === "create-impl") {
      expect(intent.specPrNumber).toBe(43);
      expect(intent.issueNumber).toBe(42);
    }
  });
});

describe("classify — visible noops", () => {
  it("openspec:go on a closed issue → visible noop", () => {
    const intent = classify("issues", issueLabeled({ state: "closed" }));
    expect(intent.kind).toBe("noop");
    if (intent.kind === "noop") {
      expect(intent.visible).toBe(true);
      expect(intent.reason).toMatch(/closed/i);
    }
  });

  it("openspec:go on a PR with neither lifecycle label → visible noop (foreign PR)", () => {
    const intent = classify("pull_request", prLabeled({ labels: ["openspec:go"] }));
    expect(intent.kind).toBe("noop");
    if (intent.kind === "noop") {
      expect(intent.visible).toBe(true);
      expect(intent.reason).toMatch(/not managed/);
    }
  });

  it("openspec:go on PR with both lifecycle labels → visible noop", () => {
    const intent = classify(
      "pull_request",
      prLabeled({ labels: ["openspec:spec", "openspec:impl", "openspec:go"] }),
    );
    expect(intent.kind).toBe("noop");
    if (intent.kind === "noop") expect(intent.visible).toBe(true);
  });

  it("user manually applies openspec:spec → visible noop, transfer mode", () => {
    const intent = classify(
      "pull_request",
      prLabeled({ labelAdded: "openspec:spec", labels: ["openspec:spec"] }),
    );
    expect(intent.kind).toBe("noop");
    if (intent.kind === "noop") {
      expect(intent.visible).toBe(true);
      expect(intent.reason).toMatch(/stepping back/);
    }
  });

  it("spec PR closed unmerged → visible noop", () => {
    const intent = classify(
      "pull_request",
      prClosed({ merged: false, labels: ["openspec:spec"] }),
    );
    expect(intent.kind).toBe("noop");
    if (intent.kind === "noop") {
      expect(intent.visible).toBe(true);
      expect(intent.reason).toMatch(/without merging/);
    }
  });
});

describe("classify — silent noops", () => {
  it("non-trigger label on issue → silent noop", () => {
    const intent = classify("issues", issueLabeled({ labelAdded: "bug" }));
    expect(intent.kind).toBe("noop");
    if (intent.kind === "noop") expect(intent.visible).toBe(false);
  });

  it("bot sender → silent noop", () => {
    const intent = classify("issues", issueLabeled({ senderType: "Bot" }));
    expect(intent.kind).toBe("noop");
    if (intent.kind === "noop") expect(intent.visible).toBe(false);
  });

  it("impl PR merged → silent noop (no action needed)", () => {
    const intent = classify(
      "pull_request",
      prClosed({ merged: true, labels: ["openspec:impl"] }),
    );
    expect(intent.kind).toBe("noop");
    if (intent.kind === "noop") expect(intent.visible).toBe(false);
  });

  it("unsupported event → silent noop", () => {
    const intent = classify("push", { sender: { type: "User" } });
    expect(intent.kind).toBe("noop");
    if (intent.kind === "noop") expect(intent.visible).toBe(false);
  });
});

describe("describe", () => {
  it("formats create-spec with title", () => {
    expect(describeIntent({ kind: "create-spec", issueNumber: 42, title: "x" })).toContain(
      "issue #42",
    );
  });

  it("formats visible noop with 'Ignored:' prefix", () => {
    expect(
      describeIntent({ kind: "noop", visible: true, reason: "PR is closed" }),
    ).toBe("Ignored: PR is closed.");
  });
});
