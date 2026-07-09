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

// Resolve `owner/repo` of the cwd's GitHub remote (or null). Used by
// install to embed a workflow-status badge in the README. Best-effort
// — null when no origin, non-GitHub, or git absent.
export const resolveRemote = (cwd: string): string | null => {
  try {
    const url = execSync("git remote get-url origin", {
      cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const m = url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
};

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
      anthropic:
        names.has("ANTHROPIC_API_KEY") || names.has("CLAUDE_CODE_OAUTH_TOKEN")
          ? "present"
          : "absent",
    };
  } catch {
    return { available: false, reason: "gh secret list failed (no remote or unauth?)", anthropic: "unknown" };
  }
};

// The three contract labels (CLAUDE.md). Canonical color + description
// so a printed `gh label create` produces a consistent appearance
// rather than the grey auto-created label GitHub makes on first apply.
export interface ContractLabel {
  name: string;
  color: string;
  description: string;
}

export const CONTRACT_LABELS: ContractLabel[] = [
  { name: "openspec:go", color: "0969da", description: "Trigger: start or re-run openspec-flow" },
  { name: "openspec:spec", color: "8250df", description: "Spec PR raised by openspec-flow" },
  { name: "openspec:impl", color: "1a7f37", description: "Implementation PR raised by openspec-flow" },
];

export interface LabelProbe {
  available: boolean;
  reason?: string;
  // Contract labels not present on the repo. Empty when all present.
  missing: ContractLabel[];
}

// Read-only `gh label list` probe. Never creates, edits, or deletes a
// label — missing ones are reported so the caller can print the
// create commands. Failure modes degrade to "unavailable".
export const probeLabels = (cwd: string): LabelProbe => {
  if (!which("gh")) {
    return { available: false, reason: "gh CLI not on PATH", missing: [] };
  }
  try {
    const out = execSync("gh label list --json name", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const have = new Set<string>(
      (JSON.parse(out) as Array<{ name: string }>).map((l) => l.name),
    );
    return {
      available: true,
      missing: CONTRACT_LABELS.filter((l) => !have.has(l.name)),
    };
  } catch {
    return { available: false, reason: "gh label list failed (no remote or unauth?)", missing: [] };
  }
};
