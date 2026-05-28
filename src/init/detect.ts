// Detect adjacent tooling so `init` can give context-aware hints
// without prompting. Everything here is best-effort and read-only:
// a failing probe degrades to "not detected", never throws.

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface Detections {
  openspecDir: boolean;
  openspecBin: boolean;
  // Locations where openspec-* skills surfaced. Each entry is a
  // directory path that contains at least one matching skill.
  skillDirs: string[];
}

const dirExists = (p: string): boolean => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const which = (cmd: string): boolean => {
  try {
    // `command -v` is POSIX; `where` on Windows. The repo targets
    // macOS/Linux dev loops so the POSIX path is fine.
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

// Look in both the project `.claude/skills` and the user-global
// `~/.claude/skills` dir for anything that looks like an OpenSpec
// skill. We only care that *something* matches; we don't enumerate.
const findSkillDirs = (cwd: string): string[] => {
  const candidates = [
    path.join(cwd, ".claude", "skills"),
    path.join(os.homedir(), ".claude", "skills"),
  ];
  const hits: string[] = [];
  for (const dir of candidates) {
    if (!dirExists(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      if (entries.some((e) => e.startsWith("openspec-") || e === "openspec")) {
        hits.push(dir);
      }
    } catch {
      // Permission errors etc. — silent skip.
    }
  }
  return hits;
};

export const detect = (cwd: string): Detections => ({
  openspecDir: dirExists(path.join(cwd, "openspec")),
  openspecBin: which("openspec"),
  skillDirs: findSkillDirs(cwd),
});

export const openspecPresent = (d: Detections): boolean =>
  d.openspecDir || d.openspecBin || d.skillDirs.length > 0;

export type SecretState = "present" | "absent" | "unknown";

export interface SecretProbe {
  available: boolean; // gh on PATH + repo resolves
  reason?: string;    // why unavailable (no gh, no remote, gh errored)
  anthropic: SecretState;
}

// Read-only `gh secret list` probe. Never logs or echoes values —
// only presence/absence by name. Failure modes degrade to "unknown".
export const probeSecrets = (cwd: string): SecretProbe => {
  if (!which("gh")) {
    return { available: false, reason: "gh CLI not on PATH", anthropic: "unknown" };
  }
  try {
    // -R inferred from cwd's git remote when omitted; `gh secret list`
    // exits non-zero if not in a GitHub-remote-bearing repo.
    const out = execSync("gh secret list --json name", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const names = new Set<string>(
      (JSON.parse(out) as Array<{ name: string }>).map((s) => s.name),
    );
    return {
      available: true,
      anthropic: names.has("ANTHROPIC_API_KEY") ? "present" : "absent",
    };
  } catch {
    return { available: false, reason: "gh secret list failed (no remote or unauth?)", anthropic: "unknown" };
  }
};
