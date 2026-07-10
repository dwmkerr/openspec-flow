import { renderWorkflow } from "./templates";

describe("renderWorkflow", () => {
  it("renders without a broker URL when none is provided (runs as github-actions[bot])", () => {
    const out = renderWorkflow();
    expect(out).not.toContain("oidc_broker_url:");
    expect(out).toContain("uses: dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml");
  });

  it("injects `with: oidc_broker_url:` when a broker URL is provided", () => {
    const out = renderWorkflow({ brokerUrl: "https://openspec-flow-dev.fly.dev" });
    expect(out).toContain("with:");
    expect(out).toContain("oidc_broker_url: 'https://openspec-flow-dev.fly.dev'");
    // The with block must sit BETWEEN uses: and secrets: so YAML still
    // parses (uses must come before with/secrets at the job level).
    // Anchor on the indented YAML keys to skip the `with:` substring
    // that appears in a free-text comment near the top of the template.
    const usesIdx = out.indexOf("uses: dwmkerr/openspec-flow");
    const withIdx = out.indexOf("    with:\n");
    const secretsIdx = out.indexOf("    secrets:");
    expect(usesIdx).toBeLessThan(withIdx);
    expect(withIdx).toBeLessThan(secretsIdx);
  });

  it("preserves a custom ref string when no broker is set", () => {
    const out = renderWorkflow("v1.2.3");
    expect(out).toContain("openspec-flow.yml@v1.2.3");
    expect(out).not.toContain("oidc_broker_url:");
  });

  it("supports both ref and broker URL via the options form", () => {
    const out = renderWorkflow({ ref: "v1.2.3", brokerUrl: "https://example.com" });
    expect(out).toContain("openspec-flow.yml@v1.2.3");
    expect(out).toContain("oidc_broker_url: 'https://example.com'");
  });
});
