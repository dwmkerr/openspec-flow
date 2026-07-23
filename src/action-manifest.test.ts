import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

type ActionStep = {
  name?: string;
  if?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
};

type Manifest = {
  runs?: { steps?: ActionStep[] };
  jobs?: Record<string, { steps?: ActionStep[] }>;
};

const readYaml = (path: string): Manifest =>
  parse(readFileSync(join(process.cwd(), path), "utf8")) as Manifest;

const namedStep = (steps: ActionStep[] | undefined, name: string): ActionStep => {
  const step = steps?.find((candidate) => candidate.name === name);
  if (!step) throw new Error(`Missing step: ${name}`);
  return step;
};

describe("GitHub action manifests", () => {
  it("keeps caller-only vars context out of the composite action", () => {
    const source = readFileSync(join(process.cwd(), "action.yml"), "utf8");
    const action = readYaml("action.yml");
    const broker = namedStep(action.runs?.steps, "Mint App token (OIDC broker)");
    const legacy = namedStep(action.runs?.steps, "Mint App token (legacy secrets)");

    expect(source).not.toContain("${{ vars.");
    expect(broker.if).toBe("${{ inputs.oidc_broker_url != '' }}");
    expect(broker.env?.BROKER_URL).toBe("${{ inputs.oidc_broker_url }}");
    expect(broker.env?.BROKER_AUDIENCE).toBe("${{ inputs.oidc_broker_audience }}");
    expect(legacy.if).toBe("${{ inputs.oidc_broker_url == '' && inputs.app_id != '' }}");
  });

  it("resolves repo variables in the reusable workflow before invoking the action", () => {
    const workflow = readYaml(".github/workflows/openspec-flow.yml");
    const run = namedStep(workflow.jobs?.flow.steps, "Run openspec-flow");

    expect(run.with?.oidc_broker_url).toBe(
      "${{ vars.OPENSPEC_FLOW_BROKER_URL || inputs.oidc_broker_url }}",
    );
    expect(run.with?.oidc_broker_audience).toBe(
      "${{ vars.OPENSPEC_FLOW_BROKER_AUDIENCE || inputs.oidc_broker_audience }}",
    );
  });
});
