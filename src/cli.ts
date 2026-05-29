// openspec-flow CLI. Commander command tree:
//
//   openspec-flow install      scaffold a repo
//   openspec-flow uninstall    tear it down
//   openspec-flow dispatch     Action-mode entry (reads $GITHUB_EVENT_*)
//   openspec-flow handle <intent>   run one handler (CI / dev plumbing)
//
// `install`/`uninstall` are the user-facing pair. `dispatch` and
// `handle` are the runtime plumbing the GitHub Action and dev loop use.
// Each command carries its own --help; the top level just lists them.

import { Command, CommanderError } from "commander";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("../package.json") as { version: string };

// Pretty stdout logger. Matches the RunAgentLogger surface; uses
// process.stdout directly so output is unbuffered.
const stdoutLogger = {
  info: (msg: string): void => {
    process.stdout.write(msg + "\n");
  },
  warn: (msg: string): void => {
    process.stderr.write("warn: " + msg + "\n");
  },
};

const splitRepo = (repo: string): { owner: string; name: string } => {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`--repo must be owner/name (got "${repo}")`);
  return { owner, name };
};

const ghToken = (): string => {
  const token = execSync("gh auth token", { encoding: "utf8" }).trim();
  if (!token) throw new Error("gh auth token returned empty; run `gh auth login`");
  return token;
};

const fetchIssueTitle = (repo: string, issue: number): string =>
  execSync(`gh issue view ${issue} -R ${repo} --json title -q .title`, {
    encoding: "utf8",
  }).trim();

// Action-mode dispatch: read the GitHub event from the runner env,
// classify with the same classify() the Probot adapter uses, and route
// through the shared dispatch core.
const runDispatchCommand = async (): Promise<number> => {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventName) throw new Error("GITHUB_EVENT_NAME is not set");
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is not set");

  const token = process.env.OPENSPEC_FLOW_TOKEN || process.env.GITHUB_TOKEN || "";
  if (!token) throw new Error("GITHUB_TOKEN is not set");

  const { readFileSync } = await import("node:fs");
  const payload = JSON.parse(readFileSync(eventPath, "utf8"));

  const { classify } = await import("./intent.js");
  const intent = classify(eventName, payload);

  if (intent.kind === "noop" && !intent.visible) {
    stdoutLogger.info(`noop — ${intent.reason} (${eventName})`);
    return 0;
  }

  const targetNum = payload?.issue?.number ?? payload?.pull_request?.number ?? null;
  if (targetNum === null) {
    stdoutLogger.warn("actionable intent but no issue/PR number on payload");
    return 0;
  }

  const owner = payload?.repository?.owner?.login;
  const name = payload?.repository?.name;
  if (!owner || !name) throw new Error("payload missing repository owner/name");

  const { Octokit } = await import("@octokit/rest");
  const octokit = new Octokit({ auth: token });
  const { runDispatch } = await import("./dispatch.js");
  await runDispatch(intent, {
    octokit: octokit as any,
    owner,
    repo: name,
    targetNumber: targetNum,
    log: stdoutLogger,
    getToken: async () => token,
  });
  return 0;
};

export const runCli = async (argv: string[]): Promise<number> => {
  let code = 0;
  const program = new Command();

  program
    .name("openspec-flow")
    .description("Drive OpenSpec spec-driven development from GitHub issues.")
    .version(pkg.version)
    .exitOverride(); // throw instead of calling process.exit, so runCli owns the code

  program
    .command("install")
    .description("Scaffold .github/workflows/openspec-flow.yml + a README block.")
    .option("--yes", "skip interactive prompts")
    .option("--force", "overwrite the managed README block when markers are present")
    .option("--path <dir>", "target directory", ".")
    .action(async (opts) => {
      const { runInstall } = await import("./install/index.js");
      code = runInstall({ cwd: resolve(opts.path), force: !!opts.force, yes: !!opts.yes });
    });

  program
    .command("uninstall")
    .description("Remove the workflow + managed README block; print label-delete commands.")
    .option("--yes", "skip interactive prompts")
    .option("--force", "remove a workflow file that has diverged from the template")
    .option("--path <dir>", "target directory", ".")
    .action(async (opts) => {
      const { runUninstall } = await import("./install/uninstall.js");
      code = runUninstall({ cwd: resolve(opts.path), force: !!opts.force, yes: !!opts.yes });
    });

  program
    .command("dispatch")
    .description("Action-mode entry: classify $GITHUB_EVENT_* and route through the dispatch core.")
    .action(async () => {
      code = await runDispatchCommand();
    });

  const handle = program
    .command("handle")
    .description("Run a single intent handler directly (CI / dev plumbing).");

  handle
    .command("create-spec")
    .requiredOption("--issue <n>", "issue number")
    .requiredOption("--repo <owner/repo>", "target repo")
    .action(async (opts) => {
      const { owner, name } = splitRepo(opts.repo);
      const token = ghToken();
      const { Octokit } = await import("@octokit/rest");
      const { handleCreateSpec } = await import("./handlers/create-spec/index.js");
      const result = await handleCreateSpec({
        owner,
        repo: name,
        issueNumber: Number(opts.issue),
        issueTitle: fetchIssueTitle(opts.repo, Number(opts.issue)),
        octokit: new Octokit({ auth: token }) as any,
        gitPushToken: token,
        log: stdoutLogger,
      });
      if (result) process.stdout.write(`\nspec PR opened: ${result.prUrl}\n`);
    });

  handle
    .command("create-impl")
    .requiredOption("--pr <spec-pr>", "merged spec PR number")
    .requiredOption("--repo <owner/repo>", "target repo")
    .action(async (opts) => {
      const { owner, name } = splitRepo(opts.repo);
      const token = ghToken();
      const { Octokit } = await import("@octokit/rest");
      const { handleCreateImpl } = await import("./handlers/create-impl/index.js");
      const result = await handleCreateImpl({
        owner,
        repo: name,
        mode: "sequential",
        specPrNumber: Number(opts.pr),
        octokit: new Octokit({ auth: token }) as any,
        gitPushToken: token,
        log: stdoutLogger,
      });
      if (result) process.stdout.write(`\nimpl PR opened: ${result.prUrl}\n`);
    });

  handle
    .command("iterate-spec")
    .requiredOption("--pr <spec-pr>", "open spec PR number")
    .requiredOption("--repo <owner/repo>", "target repo")
    .action(async (opts) => {
      const { owner, name } = splitRepo(opts.repo);
      const token = ghToken();
      const { Octokit } = await import("@octokit/rest");
      const { handleIterateSpec } = await import("./handlers/iterate-spec/index.js");
      await handleIterateSpec({
        owner,
        repo: name,
        specPrNumber: Number(opts.pr),
        octokit: new Octokit({ auth: token }) as any,
        gitPushToken: token,
        log: stdoutLogger,
      });
    });

  handle
    .command("iterate-impl")
    .requiredOption("--pr <impl-pr>", "open impl PR number")
    .requiredOption("--repo <owner/repo>", "target repo")
    .action(async (opts) => {
      const { owner, name } = splitRepo(opts.repo);
      const token = ghToken();
      const { Octokit } = await import("@octokit/rest");
      const { handleIterateImpl } = await import("./handlers/iterate-impl/index.js");
      await handleIterateImpl({
        owner,
        repo: name,
        implPrNumber: Number(opts.pr),
        octokit: new Octokit({ auth: token }) as any,
        gitPushToken: token,
        log: stdoutLogger,
      });
    });

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (err) {
    if (err instanceof CommanderError) {
      // Help / version are clean exits; commander already printed.
      if (
        err.code === "commander.helpDisplayed" ||
        err.code === "commander.version" ||
        err.code === "commander.help"
      ) {
        return 0;
      }
      return err.exitCode || 1;
    }
    throw err;
  }
  return code;
};

// Direct entry: `tsx src/cli.ts ...` or `node dist/cli.js ...`. The bin
// shim also imports the compiled module and calls runCli.
if (require.main === module) {
  runCli(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write("error: " + (err?.message ?? String(err)) + "\n");
      process.exit(1);
    });
}
