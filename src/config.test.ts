import { dispatchMode } from "./config";

describe("dispatchMode", () => {
  it("defaults to `action` when unset", () => {
    expect(dispatchMode({} as NodeJS.ProcessEnv)).toBe("action");
  });

  it("returns `in-process` when env is `in-process`", () => {
    expect(
      dispatchMode({ OPENSPEC_FLOW_DISPATCH_MODE: "in-process" } as NodeJS.ProcessEnv),
    ).toBe("in-process");
  });

  it("treats any other value as `action`", () => {
    expect(
      dispatchMode({ OPENSPEC_FLOW_DISPATCH_MODE: "bogus" } as NodeJS.ProcessEnv),
    ).toBe("action");
  });
});
