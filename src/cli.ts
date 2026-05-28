// Thin CLI seam. Both Probot (App mode) and the GitHub Action shim
// invoke the same handler functions; this CLI is how the Action mode
// and humans reach them.
//
// Usage:
//   openspec-flow handle create-spec --issue <n> --repo <owner/repo>

import { execSync } from "node:child_process";
// Handler imports are lazy: each reads a sibling prompt.md at
// module-load time, which fails outside the source tree when the
// CLI is invoked for a non-handle subcommand (eg `init`).

interface ParsedArgs {
  command?: string;
  intent?: string;
  flags: Record<string, string>;
  positional: string[];
}

// Minimal flag parser. Avoids a dep for a 50-line tool. Supports
// `--key value` and `--key=value`. Unknown flags pass through.
const parseArgs = (argv: string[]): ParsedArgs => {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          flags[a.slice(2)] = next;
          i += 1;
        } else {
          flags[a.slice(2)] = "true";
        }
      }
    } else {
      positional.push(a);
    }
  }
  return {
    command: positional[0],
    intent: positional[1],
    flags,
    positional,
  };
};

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

const usage = (): string => `usage:
  openspec-flow init [--yes] [--force] [--path <dir>]
    Scaffolds .github/workflows/openspec-flow.yml and a README block.
    Requires openspec/ already present (run \`openspec init\` first).
  openspec-flow handle create-spec   --issue <n>      --repo <owner/repo>
  openspec-flow handle create-impl   --pr <spec-pr>   --repo <owner/repo>
  openspec-flow handle iterate-spec  --pr <spec-pr>   --repo <owner/repo>
  openspec-flow handle iterate-impl  --pr <impl-pr>   --repo <owner/repo>
  openspec-flow dispatch
    Action-mode entry. Reads \$GITHUB_EVENT_NAME / \$GITHUB_EVENT_PATH,
    classifies the event, and routes through the shared dispatch core.
`;

const requireFlag = (flags: Record<string, string>, name: string): string => {
  const v = flags[name];
  if (!v) {
    throw new Error(`missing required flag --${name}`);
  }
  return v;
};

// Fetch the issue title via `gh issue view` so callers only need to
// pass the number. Throws if gh isn't authenticated for the repo.
const fetchIssueTitle = (repo: string, issue: number): string => {
  const out = execSync(
    `gh issue view ${issue} -R ${repo} --json title -q .title`,
    { encoding: "utf8" },
  );
  return out.trim();
};

export const runCli = async (argv: string[]): Promise<number> => {
  const args = parseArgs(argv);

  if (args.command === "init") {
    const { runInit } = await import("./init/index.js");
    const cwd = args.flags.path
      ? require("node:path").resolve(args.flags.path)
      : process.cwd();
    return runInit({
      cwd,
      force: args.flags.force === "true",
      yes: args.flags.yes === "true",
    });
  }

  // Action-mode entry point. Reads the GitHub event from the runner's
  // $GITHUB_EVENT_* environment, classifies it with the same classify()
  // the Probot adapter uses, and routes through the shared dispatch core.
  if (args.command === "dispatch") {
    const eventName = process.env.GITHUB_EVENT_NAME;
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventName) throw new Error("GITHUB_EVENT_NAME is not set");
    if (!eventPath) throw new Error("GITHUB_EVENT_PATH is not set");

    const token =
      process.env.OPENSPEC_FLOW_TOKEN || process.env.GITHUB_TOKEN || "";
    if (!token) throw new Error("GITHUB_TOKEN is not set");

    const { readFileSync } = await import("node:fs");
    const payload = JSON.parse(readFileSync(eventPath, "utf8"));

    const { classify } = await import("./intent.js");
    const intent = classify(eventName, payload);

    // Silent noop: nothing to do, log one line and exit clean.
    if (intent.kind === "noop" && !intent.visible) {
      stdoutLogger.info(`noop — ${intent.reason} (${eventName})`);
      return 0;
    }

    const targetNum =
      payload?.issue?.number ?? payload?.pull_request?.number ?? null;
    if (targetNum === null) {
      stdoutLogger.warn("actionable intent but no issue/PR number on payload");
      return 0;
    }

    const repo = payload?.repository;
    const owner = repo?.owner?.login;
    const name = repo?.name;
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
      // Action mode: the same token drives clone/push. App-token
      // minting happens upstream in the workflow and arrives here as
      // GITHUB_TOKEN/OPENSPEC_FLOW_TOKEN.
      getToken: async () => token,
    });
    return 0;
  }

  if (args.command !== "handle" || !args.intent) {
    process.stdout.write(usage());
    return args.command ? 1 : 0;
  }

  if (args.intent === "create-spec") {
    const issue = Number(requireFlag(args.flags, "issue"));
    const repo = requireFlag(args.flags, "repo");
    const [owner, name] = repo.split("/");
    if (!owner || !name) throw new Error(`--repo must be owner/name (got "${repo}")`);
    const title = fetchIssueTitle(repo, issue);
    const { Octokit } = await import("@octokit/rest");
    const { handleCreateSpec } = await import("./handlers/create-spec/index.js");
    const token = execSync("gh auth token", { encoding: "utf8" }).trim();
    if (!token) throw new Error("gh auth token returned empty; run `gh auth login`");
    const octokit = new Octokit({ auth: token });
    const result = await handleCreateSpec({
      owner,
      repo: name,
      issueNumber: issue,
      issueTitle: title,
      octokit: octokit as any,
      gitPushToken: token,
      log: stdoutLogger,
    });
    if (result) {
      process.stdout.write(`\nspec PR opened: ${result.prUrl}\n`);
    }
    return 0;
  }

  if (args.intent === "iterate-spec") {
    const specPr = Number(requireFlag(args.flags, "pr"));
    const repo = requireFlag(args.flags, "repo");
    const [owner, name] = repo.split("/");
    if (!owner || !name) throw new Error(`--repo must be owner/name (got "${repo}")`);
    const { Octokit } = await import("@octokit/rest");
    const { handleIterateSpec } = await import("./handlers/iterate-spec/index.js");
    const token = execSync("gh auth token", { encoding: "utf8" }).trim();
    if (!token) throw new Error("gh auth token returned empty; run `gh auth login`");
    const octokit = new Octokit({ auth: token });
    await handleIterateSpec({
      owner,
      repo: name,
      specPrNumber: specPr,
      octokit: octokit as any,
      gitPushToken: token,
      log: stdoutLogger,
    });
    return 0;
  }

  if (args.intent === "iterate-impl") {
    const implPr = Number(requireFlag(args.flags, "pr"));
    const repo = requireFlag(args.flags, "repo");
    const [owner, name] = repo.split("/");
    if (!owner || !name) throw new Error(`--repo must be owner/name (got "${repo}")`);
    const { Octokit } = await import("@octokit/rest");
    const { handleIterateImpl } = await import("./handlers/iterate-impl/index.js");
    const token = execSync("gh auth token", { encoding: "utf8" }).trim();
    if (!token) throw new Error("gh auth token returned empty; run `gh auth login`");
    const octokit = new Octokit({ auth: token });
    await handleIterateImpl({
      owner,
      repo: name,
      implPrNumber: implPr,
      octokit: octokit as any,
      gitPushToken: token,
      log: stdoutLogger,
    });
    return 0;
  }

  if (args.intent === "create-impl") {
    const specPr = Number(requireFlag(args.flags, "pr"));
    const repo = requireFlag(args.flags, "repo");
    const [owner, name] = repo.split("/");
    if (!owner || !name) throw new Error(`--repo must be owner/name (got "${repo}")`);
    const { Octokit } = await import("@octokit/rest");
    const { handleCreateImpl } = await import("./handlers/create-impl/index.js");
    const token = execSync("gh auth token", { encoding: "utf8" }).trim();
    if (!token) throw new Error("gh auth token returned empty; run `gh auth login`");
    const octokit = new Octokit({ auth: token });
    const result = await handleCreateImpl({
      owner,
      repo: name,
      mode: "sequential",
      specPrNumber: specPr,
      octokit: octokit as any,
      gitPushToken: token,
      log: stdoutLogger,
    });
    if (result) {
      process.stdout.write(`\nimpl PR opened: ${result.prUrl}\n`);
    }
    return 0;
  }

  process.stderr.write(`unknown intent: ${args.intent}\n${usage()}`);
  return 1;
};

// When this file is the process entry (`tsx src/cli.ts ...` or
// `node dist/cli.js ...`), run the CLI directly. The bin shim also
// works by importing the compiled module and calling `runCli`.
if (require.main === module) {
  runCli(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write("error: " + (err?.message ?? String(err)) + "\n");
      process.exit(1);
    });
}
