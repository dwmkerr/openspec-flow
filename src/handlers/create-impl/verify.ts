// Post-agent verification for create-impl. The agent is expected
// to have implemented + verified + archived + committed. The
// handler's HEAD-moved check covers "did the agent commit at
// all"; this module covers "did the archive land". We never parse
// the agent's reply.

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export const verifyImplWorkdir = (
  workdir: string,
  changeName: string,
): VerifyResult => {
  const changeDir = join(workdir, "openspec", "changes", changeName);
  if (existsSync(changeDir)) {
    return {
      ok: false,
      reason: `change directory openspec/changes/${changeName}/ still exists — agent didn't run \`openspec archive --yes\``,
    };
  }

  const archiveDir = join(workdir, "openspec", "changes", "archive");
  if (!existsSync(archiveDir)) {
    return {
      ok: false,
      reason: "openspec/changes/archive/ missing — agent didn't archive the change",
    };
  }

  const archived = readdirSync(archiveDir).filter((entry) => {
    const full = join(archiveDir, entry);
    return statSync(full).isDirectory() && entry.endsWith(`-${changeName}`);
  });
  if (archived.length === 0) {
    return {
      ok: false,
      reason: `no archived directory matching *-${changeName} under openspec/changes/archive/`,
    };
  }

  return { ok: true };
};
