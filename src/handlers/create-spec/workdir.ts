// Ephemeral workdir lifecycle. One per handler invocation, lives
// under OPENSPEC_FLOW_WORKDIR, removed on exit unless KEEP=true.

import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const workdirBase = (): string =>
  process.env.OPENSPEC_FLOW_WORKDIR || "/tmp/openspec-flow";

const keepWorkdir = (): boolean =>
  String(process.env.OPENSPEC_FLOW_KEEP_WORKDIR || "false").toLowerCase() === "true";

export const createWorkdir = (issueNumber: number): string => {
  const base = workdirBase();
  mkdirSync(base, { recursive: true });
  const path = join(base, `${issueNumber}-${Date.now()}`);
  mkdirSync(path, { recursive: true });
  return path;
};

export const removeWorkdir = (path: string): void => {
  if (keepWorkdir()) return;
  if (!path || !existsSync(path)) return;
  rmSync(path, { recursive: true, force: true });
};
