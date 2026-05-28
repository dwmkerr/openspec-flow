// Post-agent verification for iterate-impl. Refuses commits that
// touch forbidden paths (openspec specs/changes, the openspec-flow
// reusable workflow). Compares HEAD against the parent of HEAD —
// the agent's iteration commit must NOT have changed any of these.

import { execSync } from "node:child_process";

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

const FORBIDDEN_PREFIXES = [
  "openspec/changes/",
  "openspec/specs/",
  ".github/workflows/openspec-flow.yml",
];

const diffPaths = (workdir: string): string[] => {
  // Files changed in the iteration commit. `--no-renames` keeps the
  // path list flat; renames into a forbidden tree still count.
  const out = execSync("git diff-tree --no-commit-id --name-only -r HEAD --no-renames", {
    cwd: workdir,
    encoding: "utf8",
  });
  return out.split("\n").filter((s) => s.length > 0);
};

export const verifyIterateImplWorkdir = (workdir: string): VerifyResult => {
  const touched = diffPaths(workdir);
  const violations = touched.filter((p) =>
    FORBIDDEN_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix)),
  );
  if (violations.length > 0) {
    return {
      ok: false,
      reason:
        "iterate-impl must not modify spec artefacts or the reusable workflow. " +
        `Forbidden paths touched: ${violations.join(", ")}. ` +
        "Reopen the spec PR or file a follow-up spec change for spec edits.",
    };
  }
  return { ok: true };
};
