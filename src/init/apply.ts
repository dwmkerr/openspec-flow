// Execute a plan against the filesystem. Pure side-effects: every
// decision is upstream in plan.ts.

import * as fs from "node:fs";
import * as path from "node:path";
import type { Action } from "./plan.js";

export const readState = (cwd: string): {
  workflow: string | null;
  config: string | null;
  readme: string | null;
} => {
  const safeRead = (rel: string): string | null => {
    try {
      return fs.readFileSync(path.join(cwd, rel), "utf8");
    } catch {
      return null;
    }
  };
  return {
    workflow: safeRead(".github/workflows/openspec-flow.yml"),
    config: safeRead(".openspec-flow.yaml"),
    readme: safeRead("README.md"),
  };
};

export const apply = (action: Action): void => {
  if (action.kind === "noop") return;
  fs.mkdirSync(path.dirname(action.path), { recursive: true });
  fs.writeFileSync(action.path, action.content, "utf8");
};
