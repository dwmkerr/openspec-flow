import { assertAnthropicCredentials } from "./run.js";

describe("assertAnthropicCredentials", () => {
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

  it("throws naming both variables when neither is set", () => {
    expect(() => assertAnthropicCredentials({})).toThrow(
      /ANTHROPIC_API_KEY.*ANTHROPIC_AUTH_TOKEN/,
    );
  });
});
