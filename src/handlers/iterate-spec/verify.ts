// Post-agent verification for iterate-spec. The handler's HEAD-moved
// check covers "did the agent commit at all"; this module covers
// "did the agent stay inside the change directory" (iterate must
// not archive).

import { existsSync } from "node:fs";
import { join } from "node:path";

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export const verifyIterateWorkdir = (
  workdir: string,
  changeName: string,
): VerifyResult => {
  const changeDir = join(workdir, "openspec", "changes", changeName);
  if (!existsSync(changeDir)) {
    return {
      ok: false,
      reason: `change directory openspec/changes/${changeName}/ no longer exists — agent must not archive during iterate`,
    };
  }

  return { ok: true };
};
