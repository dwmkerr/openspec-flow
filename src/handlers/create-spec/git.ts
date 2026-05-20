// Thin git wrappers. Synchronous, throw with last-line stderr on
// failure. Sync is fine — handler runs in its own event-loop slot
// and the operations are short.

import { execFileSync } from "node:child_process";

const run = (args: string[], cwd?: string): string => {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).toString();
  } catch (err: any) {
    // Surface the full stderr so push refusals / lease failures /
    // permission errors all carry diagnostic detail. A trimmed
    // "failed to push some refs" line throws away the actual reason
    // git printed underneath it.
    const stderr = (err.stderr ?? "").toString().trim();
    throw new Error(`git ${args[0]} failed:\n${stderr || err.message}`);
  }
};

export const cloneRepo = (
  repo: string,
  workdir: string,
  token: string,
): void => {
  const url = `https://x-access-token:${token}@github.com/${repo}.git`;
  run(["clone", "--depth", "50", url, workdir]);
};

export const configIdentity = (
  workdir: string,
  name: string,
  email: string,
): void => {
  run(["config", "user.name", name], workdir);
  run(["config", "user.email", email], workdir);
};

export const checkoutNewBranch = (workdir: string, branch: string): void => {
  // -B so re-triggers on the same issue overwrite the existing local
  // branch cleanly; push uses --force-with-lease for the remote.
  run(["checkout", "-B", branch], workdir);
};

// Used by chained-mode impl: fetch the spec branch from origin and
// check it out so the workdir reflects spec changes before we ask
// the agent to implement on top. The explicit `<branch>:<branch>`
// refspec creates a local branch directly — needed because our
// shallow / single-branch clone doesn't auto-create local refs for
// non-default branches via plain `git fetch origin <branch>`.
export const fetchAndCheckoutBranch = (workdir: string, branch: string): void => {
  run(["fetch", "origin", `+refs/heads/${branch}:refs/heads/${branch}`], workdir);
  run(["checkout", branch], workdir);
};

// Pure git status check used to verify the agent actually modified
// the working tree. Returns trimmed porcelain output; empty string
// means nothing changed.
export const statusPorcelain = (workdir: string): string => {
  return run(["status", "--porcelain"], workdir).trim();
};

// HEAD sha — used to detect whether the agent committed during a
// handler run (snapshot before agent, compare after). The agent
// owns commit; the harness only checks that something happened.
export const headSha = (workdir: string): string => {
  return run(["rev-parse", "HEAD"], workdir).trim();
};

export const addAll = (workdir: string): void => {
  run(["add", "-A"], workdir);
};

export const commit = (workdir: string, message: string): void => {
  run(["commit", "-m", message], workdir);
};

export const pushBranch = (workdir: string, branch: string): void => {
  // Look up the remote tip directly via ls-remote so we can pass an
  // EXPLICIT lease to push. The bare `--force-with-lease` form relies
  // on a local remote-tracking ref that our shallow / single-branch
  // clone doesn't maintain for branches other than `main`, which
  // makes it refuse every push as "stale info" even right after a
  // fetch. The explicit `--force-with-lease=<branch>:<sha>` form
  // sidesteps that — and still protects against concurrent writers
  // because if someone pushed between our ls-remote and our push,
  // the SHA they wrote won't match the SHA we passed.
  const lsRemote = run(["ls-remote", "origin", `refs/heads/${branch}`], workdir).trim();
  const remoteSha = lsRemote ? lsRemote.split(/\s+/)[0] : "";

  if (remoteSha) {
    run(
      ["push", `--force-with-lease=${branch}:${remoteSha}`, "-u", "origin", branch],
      workdir,
    );
  } else {
    // First push for this branch — nothing to lease against.
    run(["push", "-u", "origin", branch], workdir);
  }
};
