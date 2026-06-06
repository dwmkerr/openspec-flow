// Orchestrator for `openspec-flow install`. Wires detect → plan → apply
// and renders the report. Returns a process exit code.

import chalk from "chalk";
import {
  detect,
  probeSecrets,
  probeLabels,
  type Detections,
  type SecretProbe,
  type LabelProbe,
} from "./detect.js";
import { apply, readState } from "./apply.js";
import { allNoop, plan, type Action } from "./plan.js";

export interface InstallOptions {
  cwd: string;
  force: boolean;
  yes: boolean;
  // Bake a `broker_url:` input into the rendered shim. Power users
  // testing against a non-default broker (Fly dev, self-hosted) can
  // pass it explicitly; unset = falls through to the reusable
  // workflow's default at run time.
  brokerUrl?: string;
}

const symbols = {
  write: chalk.green("+"),
  patch: chalk.cyan("~"),
  noop: chalk.dim("·"),
  hint: chalk.yellow("!"),
  ok: chalk.green("✓"),
  fail: chalk.red("✗"),
};

const renderDetections = (d: Detections): string[] => {
  const fmt = (label: string, found: boolean, extra?: string) =>
    `  ${found ? symbols.ok : symbols.noop} ${label}${extra ? chalk.dim(` — ${extra}`) : ""}`;
  return [
    chalk.bold("OpenSpec environment"),
    fmt("openspec/ directory", d.openspecDir),
    fmt("openspec CLI on PATH", d.openspecBin),
    fmt(
      "openspec-* skills",
      d.skillDirs.length > 0,
      d.skillDirs.length > 0 ? `${d.skillDirs.length} location(s)` : undefined,
    ),
  ];
};

const renderSecrets = (s: SecretProbe): string[] => {
  const lines: string[] = [chalk.bold("Secrets")];
  if (!s.available) {
    lines.push(`  ${symbols.noop} ANTHROPIC_API_KEY ${chalk.dim(`— check skipped (${s.reason})`)}`);
    return lines;
  }
  if (s.anthropic === "present") {
    lines.push(`  ${symbols.ok} ANTHROPIC_API_KEY ${chalk.dim("— set on repo")}`);
  } else {
    lines.push(`  ${symbols.fail} ANTHROPIC_API_KEY ${chalk.yellow("— missing; set before merging the setup PR")}`);
  }
  return lines;
};

const renderLabels = (l: LabelProbe): string[] => {
  const lines: string[] = [chalk.bold("Labels")];
  if (!l.available) {
    lines.push(`  ${symbols.noop} contract labels ${chalk.dim(`— check skipped (${l.reason})`)}`);
    return lines;
  }
  if (l.missing.length === 0) {
    lines.push(`  ${symbols.ok} openspec:go / openspec:spec / openspec:impl ${chalk.dim("— all present")}`);
    return lines;
  }
  for (const m of l.missing) {
    lines.push(`  ${symbols.fail} ${m.name} ${chalk.yellow("— missing")}`);
  }
  return lines;
};

// Print the gh command to set the required secret. Mirrors the
// label-commands pattern — install makes no remote writes; the user
// runs the command themselves. Omitted when the secret is already
// present.
const renderSecretCommands = (s: SecretProbe): string[] => {
  if (s.available && s.anthropic === "present") return [];
  return [
    "",
    chalk.bold("Set the required secret"),
    chalk.dim("  run this (install does not write to the repo):"),
    `  ${chalk.cyan(`gh secret set ANTHROPIC_API_KEY`)}  ${chalk.dim("# Setup Anthropic key")}`,
  ];
};

// Print the gh commands rather than running them — init makes no
// remote writes. A future `--github-labels` flag will execute these.
const renderLabelCommands = (l: LabelProbe): string[] => {
  if (!l.available || l.missing.length === 0) return [];
  const lines = [
    "",
    chalk.bold("Create the missing labels"),
    chalk.dim("  run these (init does not write to the repo):"),
  ];
  for (const m of l.missing) {
    lines.push(
      `  ${chalk.cyan(`gh label create "${m.name}" --color ${m.color} --description "${m.description}"`)}`,
    );
  }
  lines.push(chalk.dim("  (a future `openspec-flow install --github-labels` will run these for you)"));
  return lines;
};

const renderAction = (a: Action): string => {
  const rel = a.path;
  switch (a.kind) {
    case "write":
      return `  ${symbols.write} ${rel} ${chalk.dim(`— ${a.reason}`)}`;
    case "patch-readme":
      return `  ${symbols.patch} ${rel} ${chalk.dim(`— ${a.reason}`)}`;
    case "noop":
      return `  ${symbols.noop} ${rel} ${chalk.dim(`— ${a.reason}`)}`;
  }
};

const renderNextSteps = (): string[] => [
  "",
  chalk.bold("Next steps"),
  `  1. ${chalk.dim("review the diff:")} ${chalk.cyan("git diff")}`,
  `  2. ${chalk.dim("commit on a feature branch and open a PR titled:")} ${chalk.cyan("chore: openspec-flow setup")}`,
  `  3. ${chalk.dim("after merge, open an issue and add the")} ${chalk.cyan("openspec:go")} ${chalk.dim("label.")}`,
  "",
  chalk.dim("  (the gh commands above set up the secret + labels — run them once.)"),
];

export const runInstall = (opts: InstallOptions): number => {
  const log = (line: string) => process.stdout.write(line + "\n");

  log("");
  log(chalk.bold.magenta("openspec-flow install"));
  log(chalk.dim(`  working in: ${opts.cwd}`));
  log("");

  const detections = detect(opts.cwd);
  renderDetections(detections).forEach(log);

  // Hard gate: without OpenSpec scaffolded, the workflow we write
  // would have nothing to operate on. Fail loud now rather than
  // ship a broken-on-day-one install.
  if (!detections.openspecDir) {
    log("");
    log(chalk.red(`  ${symbols.fail} openspec/ not found in this repo.`));
    log("");
    log(chalk.bold("Run OpenSpec first:"));
    log(`  ${chalk.cyan("npx @fission-ai/openspec init")}`);
    log(chalk.dim("  That scaffolds openspec/, selects AI tools, and installs skills."));
    log(chalk.dim("  Then re-run `openspec-flow install`."));
    log("");
    return 1;
  }

  log("");
  const secrets = probeSecrets(opts.cwd);
  renderSecrets(secrets).forEach(log);
  log("");

  const labels = probeLabels(opts.cwd);
  renderLabels(labels).forEach(log);
  log("");

  const fs = readState(opts.cwd);
  const state = { cwd: opts.cwd, ...fs };
  const actions = plan(state, { force: opts.force, brokerUrl: opts.brokerUrl });

  log(chalk.bold("Plan"));
  actions.forEach((a) => log(renderAction(a)));

  if (allNoop(actions)) {
    log("");
    log(`  ${symbols.ok} already initialised — nothing to do.`);
    renderSecretCommands(secrets).forEach(log);
    renderLabelCommands(labels).forEach(log);
    log("");
    return 0;
  }

  if (!process.stdout.isTTY && !opts.yes) {
    log("");
    log(chalk.red("  refusing to run non-interactively without --yes"));
    return 2;
  }

  log("");
  log(chalk.bold("Applying"));
  for (const action of actions) {
    if (action.kind === "noop") continue;
    apply(action);
    log(`  ${symbols.ok} wrote ${action.path}`);
  }

  renderSecretCommands(secrets).forEach(log);
  renderLabelCommands(labels).forEach(log);
  renderNextSteps().forEach(log);
  log("");
  return 0;
};
