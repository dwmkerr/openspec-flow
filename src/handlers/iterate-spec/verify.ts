// Post-agent verification for iterate-spec. Differs from
// create-impl's verify: we expect the change dir to STILL exist
// (iterate is not archive), AND we want a non-empty git status to
// prove the agent actually changed something.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { statusPorcelain } from "../create-spec/git.js";

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export const verifyIterateWorkdir = (
  workdir: string,
  changeName: string,
): VerifyResult => {
  const dirty = statusPorcelain(workdir);
  if (!dirty) {
    return { ok: false, reason: "agent produced no changes" };
  }

  const changeDir = join(workdir, "openspec", "changes", changeName);
  if (!existsSync(changeDir)) {
    return {
      ok: false,
      reason: `change directory openspec/changes/${changeName}/ no longer exists — agent must not archive during iterate`,
    };
  }

  return { ok: true };
};
