import { currentRunUrl, renderRunLink } from "./run-link";

describe("currentRunUrl", () => {
  it("returns the run URL when GitHub Actions env vars are set", () => {
    expect(
      currentRunUrl({
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "dwmkerr/livedown",
        GITHUB_RUN_ID: "27003368520",
      } as NodeJS.ProcessEnv),
    ).toBe("https://github.com/dwmkerr/livedown/actions/runs/27003368520");
  });

  it("defaults SERVER_URL to github.com when only the other vars are set", () => {
    expect(
      currentRunUrl({
        GITHUB_REPOSITORY: "dwmkerr/livedown",
        GITHUB_RUN_ID: "1",
      } as NodeJS.ProcessEnv),
    ).toBe("https://github.com/dwmkerr/livedown/actions/runs/1");
  });

  it("returns null without REPOSITORY or RUN_ID", () => {
    expect(currentRunUrl({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      currentRunUrl({ GITHUB_REPOSITORY: "x/y" } as NodeJS.ProcessEnv),
    ).toBeNull();
  });
});

describe("renderRunLink", () => {
  it("renders a watch line when in Action context", () => {
    expect(
      renderRunLink({
        GITHUB_REPOSITORY: "dwmkerr/livedown",
        GITHUB_RUN_ID: "27003368520",
      } as NodeJS.ProcessEnv),
    ).toContain("https://github.com/dwmkerr/livedown/actions/runs/27003368520");
  });

  it("returns empty string when not in Action context", () => {
    expect(renderRunLink({} as NodeJS.ProcessEnv)).toBe("");
  });
});
