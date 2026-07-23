import { assertAnthropicCredentials } from "./run.js";

describe("assertAnthropicCredentials", () => {
  it("passes with only CLAUDE_CODE_OAUTH_TOKEN set", () => {
    expect(() =>
      assertAnthropicCredentials({ CLAUDE_CODE_OAUTH_TOKEN: "oauth-test" }),
    ).not.toThrow();
  });

  it("passes with only ANTHROPIC_API_KEY set", () => {
    expect(() =>
      assertAnthropicCredentials({ ANTHROPIC_API_KEY: "sk-test" }),
    ).not.toThrow();
  });

  it("passes with only ANTHROPIC_AUTH_TOKEN set", () => {
    expect(() =>
      assertAnthropicCredentials({ ANTHROPIC_AUTH_TOKEN: "bearer-test" }),
    ).not.toThrow();
  });

  it("throws naming every supported variable when none is set", () => {
    expect(() => assertAnthropicCredentials({})).toThrow(
      /CLAUDE_CODE_OAUTH_TOKEN.*ANTHROPIC_API_KEY.*ANTHROPIC_AUTH_TOKEN/,
    );
  });
});
