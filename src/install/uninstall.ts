// Orchestrator for `openspec-flow uninstall`. The inverse of install:
// removes the workflow shim, strips the managed README block (leaving
// surrounding content untouched), and prints `gh label delete` commands
// for the contract labels. Like install, it makes no remote writes —
// label deletion is printed, not executed (a future --github-labels
// will run them).

import chalk from "chalk";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONTRACT_LABELS } from "./detect.js";
import { renderWorkflow, README_MARKER_START, README_MARKER_END } from "./templates.js";

export interface UninstallOptions {
  cwd: string;
  force: boolean;
  yes: boolean;
}

const symbols = {
  remove: chalk.red("-"),
  noop: chalk.dim("·"),
  ok: chalk.green("✓"),
  fail: chalk.red("✗"),
};

const WORKFLOW_REL = ".github/workflows/openspec-flow.yml";
const README_REL = "README.md";

// Strip the managed block (markers inclusive) plus one trailing blank
// line, leaving everything else byte-identical.
const stripBlock = (readme: string): string | null => {
  const s = readme.indexOf(README_MARKER_START);
  const e = readme.indexOf(README_MARKER_END);
  if (s === -1 || e === -1 || e < s) return null;
  const end = e + README_MARKER_END.length;
  const before = readme.slice(0, s).replace(/\n+$/, "\n");
  const after = readme.slice(end).replace(/^\n+/, "");
  return (before + after).replace(/\n{3,}/g, "\n\n");
};

export const runUninstall = (opts: UninstallOptions): number => {
  const log = (line: string) => process.stdout.write(line + "\n");

  log("");
  log(chalk.bold.magenta("openspec-flow uninstall"));
  log(chalk.dim(`  working in: ${opts.cwd}`));
  log("");

  const wfPath = join(opts.cwd, WORKFLOW_REL);
  const readmePath = join(opts.cwd, README_REL);

  // Plan first (no writes until we know there's something to do).
  type Step = { run: () => void; line: string };
  const steps: Step[] = [];

  if (existsSync(wfPath)) {
    const current = readFileSync(wfPath, "utf8");
    const matchesTemplate = current === renderWorkflow();
    if (matchesTemplate || opts.force) {
      steps.push({
        run: () => rmSync(wfPath),
        line: `  ${symbols.remove} ${WORKFLOW_REL} ${chalk.dim(matchesTemplate ? "— removing shim" : "— force: removing diverged workflow")}`,
      });
    } else {
      log(`  ${symbols.fail} ${WORKFLOW_REL} ${chalk.yellow("— diverged from template; re-run with --force to remove")}`);
    }
  }

  if (existsSync(readmePath)) {
    const readme = readFileSync(readmePath, "utf8");
    const stripped = stripBlock(readme);
    if (stripped !== null && stripped !== readme) {
      steps.push({
        run: () => writeFileSync(readmePath, stripped, "utf8"),
        line: `  ${symbols.remove} ${README_REL} ${chalk.dim("— stripping managed block")}`,
      });
    }
  }

  if (steps.length === 0) {
    log(`  ${symbols.ok} nothing to uninstall — no openspec-flow artefacts found.`);
    log("");
    return 0;
  }

  log(chalk.bold("Plan"));
  steps.forEach((s) => log(s.line));

  if (!process.stdout.isTTY && !opts.yes) {
    log("");
    log(chalk.red("  refusing to run non-interactively without --yes"));
    return 2;
  }

  log("");
  log(chalk.bold("Removing"));
  for (const s of steps) {
    s.run();
    log(s.line.replace(symbols.remove, symbols.ok));
  }

  // Labels: print delete commands; never execute (mirrors install).
  log("");
  log(chalk.bold("Delete the labels (optional)"));
  log(chalk.dim("  run these if you want them gone (uninstall does not write to the repo):"));
  for (const l of CONTRACT_LABELS) {
    log(`  ${chalk.cyan(`gh label delete "${l.name}" --yes`)}`);
  }
  log(chalk.dim("  (a future `openspec-flow uninstall --github-labels` will run these for you)"));
  log("");
  return 0;
};
