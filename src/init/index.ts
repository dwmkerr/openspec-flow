// Orchestrator for `openspec-flow init`. Wires detect → plan → apply
// and renders the report. Returns a process exit code.

import chalk from "chalk";
import { detect, openspecPresent, type Detections } from "./detect.js";
import { apply, readState } from "./apply.js";
import { allNoop, plan, type Action } from "./plan.js";

export interface InitOptions {
  cwd: string;
  force: boolean;
  yes: boolean;
}

const symbols = {
  write: chalk.green("+"),
  patch: chalk.cyan("~"),
  noop: chalk.dim("·"),
  hint: chalk.yellow("!"),
  ok: chalk.green("✓"),
};

const renderDetections = (d: Detections): string[] => {
  const lines: string[] = [];
  const fmt = (label: string, found: boolean, extra?: string) =>
    `  ${found ? symbols.ok : symbols.noop} ${label}${extra ? chalk.dim(` — ${extra}`) : ""}`;
  lines.push(chalk.bold("Environment"));
  lines.push(fmt("openspec/ directory", d.openspecDir));
  lines.push(fmt("openspec CLI on PATH", d.openspecBin));
  lines.push(
    fmt(
      "openspec-* skills",
      d.skillDirs.length > 0,
      d.skillDirs.length > 0 ? `${d.skillDirs.length} location(s)` : undefined,
    ),
  );
  if (!openspecPresent(d)) {
    lines.push("");
    lines.push(
      `  ${symbols.hint} ${chalk.yellow("OpenSpec not detected")}. ` +
        `Scaffold it first with: ${chalk.bold("npx @fission-ai/openspec init")}`,
    );
    lines.push(`    (openspec-flow will still write its workflow + config.)`);
  }
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
  `  2. ${chalk.dim("set the required secret on the repo:")} ${chalk.cyan("ANTHROPIC_API_KEY")}`,
  `  3. ${chalk.dim("commit on a feature branch and open a PR titled:")} ${chalk.cyan("chore: openspec-flow setup")}`,
  `  4. ${chalk.dim("after merge, open an issue and add the")} ${chalk.cyan("openspec:go")} ${chalk.dim("label to try it.")}`,
];

export const runInit = (opts: InitOptions): number => {
  const log = (line: string) => process.stdout.write(line + "\n");

  log("");
  log(chalk.bold.magenta("openspec-flow init"));
  log(chalk.dim(`  working in: ${opts.cwd}`));
  log("");

  const detections = detect(opts.cwd);
  renderDetections(detections).forEach(log);
  log("");

  const fs = readState(opts.cwd);
  const state = { cwd: opts.cwd, ...fs };
  const actions = plan(state, { force: opts.force });

  log(chalk.bold("Plan"));
  actions.forEach((a) => log(renderAction(a)));

  if (allNoop(actions)) {
    log("");
    log(`  ${symbols.ok} already initialised — nothing to do.`);
    return 0;
  }

  // TTY guard: if not a TTY and --yes not passed, refuse to write.
  // In a TTY without --yes we still apply (this slice skips the
  // confirm prompt — defer to follow-up if it bites).
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

  renderNextSteps().forEach(log);
  log("");
  return 0;
};
