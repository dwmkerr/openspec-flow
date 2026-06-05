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
// Load .env at module-load so `--as-app` (and any future env-driven
// flags) pick up OPENSPEC_FLOW_APP_ID / PRIVATE_KEY_PATH without the
// operator having to source it manually. Probot loads it automatically;
// the CLI didn't until now.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config();

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

// Resolve a GitHub token for `app-init`. Order: --token flag, env
// GITHUB_TOKEN, `gh auth token`. Throw with a named missing-credential
// when nothing works so the CLI exits non-zero with a clear message.
const resolveAppInitToken = (flag?: string): string => {
  if (flag) return flag;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return ghToken();
  } catch {
    throw new Error(
      "no GitHub token: pass --token, set GITHUB_TOKEN, or run `gh auth login`",
    );
  }
};

// Mint an installation token so the PR is authored by the App
// (`<slug>[bot]`) rather than the operator's user. Requires the App's
// id + private key in env and the App to be already installed on the
// target repo. A 404 from `apps.getRepoInstallation` is surfaced with
// the install URL — the most common failure mode is forgetting the
// install step.
const mintInstallationToken = async (
  owner: string,
  name: string,
): Promise<string> => {
  const appId = process.env.OPENSPEC_FLOW_APP_ID || process.env.APP_ID;
  const privateKeyPath =
    process.env.OPENSPEC_FLOW_PRIVATE_KEY_PATH || process.env.PRIVATE_KEY_PATH;
  if (!appId) {
    throw new Error("--as-app requires OPENSPEC_FLOW_APP_ID (or APP_ID) in env");
  }
  if (!privateKeyPath) {
    throw new Error(
      "--as-app requires OPENSPEC_FLOW_PRIVATE_KEY_PATH (or PRIVATE_KEY_PATH) in env",
    );
  }
  const { readFileSync } = await import("node:fs");
  const privateKey = readFileSync(privateKeyPath, "utf8");
  const { createAppAuth } = await import("@octokit/auth-app");
  const { Octokit } = await import("@octokit/rest");
  const appAuth = createAppAuth({ appId, privateKey });
  const appOctokit = new Octokit({ authStrategy: undefined, auth: (await appAuth({ type: "app" })).token });
  let installationId: number;
  try {
    const res = await appOctokit.apps.getRepoInstallation({ owner, repo: name });
    installationId = res.data.id;
  } catch (err: any) {
    if (err?.status === 404) {
      throw new Error(
        `--as-app: GitHub App (id ${appId}) is not installed on ` +
          `${owner}/${name}. Install it on the repo, then re-run.\n` +
          `  Find install URL: https://github.com/settings/installations`,
      );
    }
    throw err;
  }
  const installAuth = await appAuth({ type: "installation", installationId });
  return (installAuth as { token: string }).token;
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
  const result = await runDispatch(intent, {
    octokit: octokit as any,
    owner,
    repo: name,
    targetNumber: targetNum,
    log: stdoutLogger,
    getToken: async () => token,
  });
  // Bubble handler failure into the runner's exit code so the
  // workflow's red/green badge matches reality. Pre-fix, every
  // crashed handler exited 0 and the run showed green.
  if (!result.ok) {
    stdoutLogger.warn(`dispatch failed: ${result.error?.message ?? "unknown"}`);
    return 1;
  }
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
    .command("app-init")
    .description(
      "Preview or open the App-install setup PR against a remote repo " +
        "(same core the App's installation.created handler runs).",
    )
    .requiredOption("--repo <owner/name>", "target repository")
    .option("--dry-run", "compute the plan without writing", false)
    .option("--token <value>", "GitHub token; falls back to GITHUB_TOKEN, then `gh auth token`")
    .option("--as-app", "mint a GitHub App installation token so the PR is authored by <slug>[bot] (needs OPENSPEC_FLOW_APP_ID + OPENSPEC_FLOW_PRIVATE_KEY_PATH; App must already be installed on the target repo)")
    .action(async (opts) => {
      const { owner, name } = splitRepo(opts.repo);
      const token = opts.asApp
        ? await mintInstallationToken(owner, name)
        : resolveAppInitToken(opts.token);
      const { Octokit } = await import("@octokit/rest");
      const octokit = new Octokit({ auth: token });

      // Surface which identity will author the PR before we do
      // anything. Bot identity only happens via --as-app + an installed
      // App; without it we use the operator's user, which is fine for
      // dev but worth calling out so the operator isn't surprised when
      // the PR shows their name.
      if (opts.asApp) {
        stdoutLogger.info(`identity: GitHub App installation token (PR will be authored by <slug>[bot])`);
      } else {
        try {
          const me = await octokit.request("GET /user");
          stdoutLogger.info(
            `identity: ${me.data.login} (personal token — PR will be authored by you, not the App bot)`,
          );
          stdoutLogger.info(
            `  → for App-identity testing pass --as-app (needs OPENSPEC_FLOW_APP_ID + private key + App installed on repo)`,
          );
        } catch {
          // Identity probe is informational — never block on it.
        }
      }

      const { runAppInit } = await import("./app-install/index.js");
      const result = await runAppInit(
        { octokit: octokit as any, log: stdoutLogger },
        { owner, name },
        { dryRun: !!opts.dryRun },
      );
      if (result.skipped) {
        stdoutLogger.info(`skipped: ${result.skipped}`);
      } else if (result.prUrl) {
        stdoutLogger.info(`opened: ${result.prUrl}`);
      } else {
        stdoutLogger.info(`plan: branch=${result.branch} title="${result.prTitle}"`);
        for (const f of result.files) {
          stdoutLogger.info(`  + ${f.path} (${f.contentLength} bytes)`);
        }
      }
      code = 0;
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
