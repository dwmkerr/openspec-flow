// Precondition checks the handler runs before invoking the agent.
// Each throws a clear, user-facing message that the handler turns
// into a single failure comment on the originating issue.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const assertOpenSpecCli = (): void => {
  try {
    execFileSync("openspec", ["--version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "openspec CLI not found on PATH. Install with `npm i -g @fishtail-ai/openspec` (see https://openspec.dev).",
    );
  }
};

export const assertSkillPresent = (workdir: string): void => {
  const skillDir = join(workdir, ".claude", "skills", "openspec-new-change");
  if (!existsSync(skillDir)) {
    throw new Error(
      "openspec-new-change skill not found in target repo " +
        "(.claude/skills/openspec-new-change/). Run `openspec init` in the repo.",
    );
  }
};
