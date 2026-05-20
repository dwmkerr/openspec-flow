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
// the agent to implement on top.
export const fetchAndCheckoutBranch = (workdir: string, branch: string): void => {
  run(["fetch", "origin", branch], workdir);
  run(["checkout", branch], workdir);
};

// Pure git status check used to verify the agent actually modified
// the working tree. Returns trimmed porcelain output; empty string
// means nothing changed.
export const statusPorcelain = (workdir: string): string => {
  return run(["status", "--porcelain"], workdir).trim();
};

export const addAll = (workdir: string): void => {
  run(["add", "-A"], workdir);
};

export const commit = (workdir: string, message: string): void => {
  run(["commit", "-m", message], workdir);
};

export const pushBranch = (workdir: string, branch: string): void => {
  // Fetch the current remote ref so --force-with-lease has a real
  // lease to compare against. A fresh workdir has no local view of
  // origin/<branch>; without this fetch, force-with-lease refuses
  // every re-trigger as a stale-lease violation. If the remote
  // branch doesn't exist yet (first push), the fetch fails — swallow
  // it and let the push create the branch.
  try {
    run(["fetch", "origin", branch], workdir);
  } catch {
    // remote branch doesn't exist yet — first push will create it
  }
  // --force-with-lease still protects against concurrent writers
  // (e.g. a reviewer pushing a fix to the spec PR branch). If the
  // lease fails, the handler catches the error and posts a visible
  // failure comment so the operator can switch to iterate-spec.
  run(["push", "--force-with-lease", "-u", "origin", branch], workdir);
};
