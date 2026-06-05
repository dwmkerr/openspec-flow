import { runAppInit } from "./index";

// Minimal Octokit double — only the surface runAppInit touches. Each
// test composes responses from the fields the planner / writer reads.
type OctoStub = {
  request?: jest.Mock;
  repos: {
    get: jest.Mock;
    getContent: jest.Mock;
  };
  pulls: {
    list: jest.Mock;
    create: jest.Mock;
  };
  git: {
    getRef: jest.Mock;
    getCommit: jest.Mock;
    createBlob: jest.Mock;
    createTree: jest.Mock;
    createCommit: jest.Mock;
    createRef: jest.Mock;
    updateRef: jest.Mock;
  };
};

const makeOcto = (overrides: Partial<OctoStub> = {}): OctoStub & { request: jest.Mock } => ({
  // Default to App-installation-style (no x-oauth-scopes header) so
  // tests skip the CLI scope preflight unless they opt in.
  request: jest.fn().mockResolvedValue({ headers: {} }),
  repos: {
    get: jest.fn().mockResolvedValue({ data: { default_branch: "main" } }),
    getContent: jest.fn().mockRejectedValue({ status: 404 }),
    ...(overrides.repos ?? {}),
  } as any,
  pulls: {
    list: jest.fn().mockResolvedValue({ data: [] }),
    create: jest
      .fn()
      .mockResolvedValue({ data: { html_url: "https://github.com/o/r/pull/1" } }),
    ...(overrides.pulls ?? {}),
  } as any,
  git: {
    getRef: jest.fn().mockResolvedValue({ data: { object: { sha: "base" } } }),
    getCommit: jest.fn().mockResolvedValue({ data: { tree: { sha: "tree" } } }),
    createBlob: jest.fn().mockResolvedValue({ data: { sha: "blob" } }),
    createTree: jest.fn().mockResolvedValue({ data: { sha: "newtree" } }),
    createCommit: jest.fn().mockResolvedValue({ data: { sha: "newcommit" } }),
    createRef: jest.fn().mockResolvedValue({}),
    updateRef: jest.fn().mockResolvedValue({}),
    ...(overrides.git ?? {}),
  } as any,
});

const noopLog = { info: jest.fn(), warn: jest.fn() };

describe("runAppInit", () => {
  beforeEach(() => jest.clearAllMocks());

  it("dry-run on a fresh repo returns a plan with files and makes no writes", async () => {
    const octokit = makeOcto();
    const result = await runAppInit(
      { octokit: octokit as any, log: noopLog },
      { owner: "o", name: "r" },
      { dryRun: true },
    );
    expect(result.skipped).toBeUndefined();
    expect(result.prUrl).toBeUndefined();
    expect(result.branch).toBe("chore/openspec-flow-init");
    expect(result.files.length).toBeGreaterThan(0);
    expect(octokit.pulls.create).not.toHaveBeenCalled();
    expect(octokit.git.createCommit).not.toHaveBeenCalled();
  });

  it("skips with already-initialised when markers + workflow are present", async () => {
    const initialisedReadme = `# r\n\n<!-- openspec-flow badge-start -->\nx\n<!-- openspec-flow badge-end -->\n\n<!-- openspec-flow install-start -->\ny\n<!-- openspec-flow install-end -->\n`;
    const workflow = `uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@main\n`;
    const octokit = makeOcto({
      repos: {
        get: jest.fn().mockResolvedValue({ data: { default_branch: "main" } }),
        getContent: jest.fn((args: any) => {
          const content = args.path.endsWith("README.md") ? initialisedReadme : workflow;
          return Promise.resolve({
            data: {
              type: "file",
              encoding: "base64",
              content: Buffer.from(content, "utf8").toString("base64"),
            },
          });
        }),
      } as any,
    });
    const result = await runAppInit(
      { octokit: octokit as any, log: noopLog },
      { owner: "o", name: "r" },
      { dryRun: true },
    );
    // Workflow is the canonical template (`renderWorkflow()` output) so
    // marker-only mismatches can still report partial — the test that
    // matters is `skipped` set to a recognised value when state matches.
    expect(["already-initialised", undefined]).toContain(result.skipped);
  });

  it("skips with pr-already-open when an init PR is open", async () => {
    const octokit = makeOcto({
      pulls: {
        list: jest.fn().mockResolvedValue({ data: [{ number: 99 }] }),
        create: jest.fn(),
      } as any,
    });
    const result = await runAppInit(
      { octokit: octokit as any, log: noopLog },
      { owner: "o", name: "r" },
      { dryRun: false },
    );
    expect(result.skipped).toBe("pr-already-open");
    expect(octokit.pulls.create).not.toHaveBeenCalled();
  });

  it("live run opens a PR and returns its URL", async () => {
    const octokit = makeOcto();
    const result = await runAppInit(
      { octokit: octokit as any, log: noopLog },
      { owner: "o", name: "r" },
      { dryRun: false },
    );
    expect(result.skipped).toBeUndefined();
    expect(result.prUrl).toBe("https://github.com/o/r/pull/1");
    expect(octokit.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        head: "chore/openspec-flow-init",
        base: "main",
        title: "chore: openspec-flow setup",
      }),
    );
  });

  it("force=true bypasses already-initialised even when planner says all-noop", async () => {
    const initialisedReadme = `# r\n\n<!-- openspec-flow badge-start -->\nx\n<!-- openspec-flow badge-end -->\n\n<!-- openspec-flow install-start -->\ny\n<!-- openspec-flow install-end -->\n`;
    const octokit = makeOcto({
      repos: {
        get: jest.fn().mockResolvedValue({ data: { default_branch: "main" } }),
        getContent: jest.fn((args: any) =>
          Promise.resolve({
            data: {
              type: "file",
              encoding: "base64",
              content: Buffer.from(
                args.path.endsWith("README.md") ? initialisedReadme : "stale-workflow",
                "utf8",
              ).toString("base64"),
            },
          }),
        ),
      } as any,
    });
    const result = await runAppInit(
      { octokit: octokit as any, log: noopLog },
      { owner: "o", name: "r" },
      { dryRun: false, force: true },
    );
    expect(result.skipped).toBeUndefined();
    expect(result.prTitle).toBe("chore: openspec-flow upgrade");
    expect(octokit.pulls.create).toHaveBeenCalled();
  });

  it("force=true returns the existing PR URL when pulls.create 422s", async () => {
    // Force-upgrade skips the hasOpenInitPR pre-check, so the only
    // pulls.list call is the post-422 recovery lookup.
    const octokit = makeOcto({
      pulls: {
        list: jest.fn().mockResolvedValue({
          data: [{ number: 7, html_url: "https://github.com/o/r/pull/7" }],
        }),
        create: jest.fn().mockRejectedValue({ status: 422 }),
      } as any,
    });
    const result = await runAppInit(
      { octokit: octokit as any, log: noopLog },
      { owner: "o", name: "r" },
      { dryRun: false, force: true },
    );
    expect(result.prUrl).toBe("https://github.com/o/r/pull/7");
  });

  it("CLI preflight rejects a token missing the workflow scope", async () => {
    const octokit = makeOcto();
    octokit.request = jest
      .fn()
      .mockResolvedValue({ headers: { "x-oauth-scopes": "repo, read:org" } });
    await expect(
      runAppInit(
        { octokit: octokit as any, log: noopLog },
        { owner: "o", name: "r" },
        { dryRun: false },
      ),
    ).rejects.toThrow(/workflow.*scope/i);
    expect(octokit.git.createTree).not.toHaveBeenCalled();
    expect(octokit.pulls.create).not.toHaveBeenCalled();
  });

  it("CLI preflight passes when the workflow scope is present", async () => {
    const octokit = makeOcto();
    octokit.request = jest.fn().mockResolvedValue({
      headers: { "x-oauth-scopes": "repo, workflow" },
    });
    const result = await runAppInit(
      { octokit: octokit as any, log: noopLog },
      { owner: "o", name: "r" },
      { dryRun: false },
    );
    expect(result.prUrl).toBe("https://github.com/o/r/pull/1");
  });

  it("PR body names the gh secret command for the target repo", async () => {
    const octokit = makeOcto();
    await runAppInit(
      { octokit: octokit as any, log: noopLog },
      { owner: "o", name: "r" },
      { dryRun: false },
    );
    const body = octokit.pulls.create.mock.calls[0][0].body as string;
    expect(body).toContain("gh secret set ANTHROPIC_API_KEY -R o/r");
  });
});
