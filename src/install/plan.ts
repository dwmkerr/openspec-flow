// Pure planner: given the current filesystem state and flags, decide
// what writes (if any) `init` should perform. No I/O here so the
// planner is trivially unit-testable and the App-install handler
// will be able to reuse it against a remote tree.

import * as path from "node:path";
import {
  BADGE_MARKER_END,
  BADGE_MARKER_START,
  README_MARKER_END,
  README_MARKER_START,
  renderBadgeBlock,
  renderMinimalReadme,
  renderReadmeBlock,
  renderWorkflow,
} from "./templates.js";
import { resolveRemote } from "./detect.js";

export interface FsState {
  cwd: string;
  workflow: string | null;
  readme: string | null;
  // Optional explicit remote `owner/name`. When undefined, the planner
  // resolves it from `cwd` via `git remote get-url origin`. App-mode
  // callers pass it directly because there is no checkout.
  remote?: string | null;
}

export type ActionKind = "write" | "patch-readme" | "noop";

export interface Action {
  kind: ActionKind;
  path: string;
  // Final file content after this action. For noop, this is the
  // existing content (used for logging only — apply() skips it).
  content: string;
  reason: string;
}

export interface PlanOptions {
  force: boolean;
  // When set, the rendered shim carries `with: broker_url: <url>` so
  // OIDC token exchange uses the install-time URL by default. Local-
  // dev installs leave this undefined to fall through to the reusable
  // workflow's hardcoded default.
  brokerUrl?: string;
  // OIDC audience required by the broker at brokerUrl. Bundled with
  // brokerUrl so each broker target gets the right audience too.
  brokerAudience?: string;
}

const WORKFLOW_REL = ".github/workflows/openspec-flow.yml";
const README_REL = "README.md";

const planWorkflow = (state: FsState, opts: PlanOptions): Action => {
  const target = renderWorkflow({
    brokerUrl: opts.brokerUrl,
    brokerAudience: opts.brokerAudience,
  });
  const abs = path.join(state.cwd, WORKFLOW_REL);
  if (state.workflow === null) {
    return { kind: "write", path: abs, content: target, reason: "creating shim" };
  }
  if (state.workflow === target) {
    return { kind: "noop", path: abs, content: state.workflow, reason: "matches template" };
  }
  // Hand-edited or stale (template moved on, broker_url added, etc).
  // With --force, overwrite; otherwise leave it alone and tell the
  // user how to upgrade.
  if (opts.force) {
    return {
      kind: "write",
      path: abs,
      content: target,
      reason: "force: overwriting divergent shim from current template",
    };
  }
  return {
    kind: "noop",
    path: abs,
    content: state.workflow,
    reason: "file diverges from template — re-run with --force to overwrite",
  };
};

const replaceBetween = (haystack: string, start: string, end: string, replacement: string): string => {
  const s = haystack.indexOf(start);
  const e = haystack.indexOf(end);
  if (s === -1 || e === -1 || e < s) return haystack;
  return haystack.slice(0, s) + replacement + haystack.slice(e + end.length);
};

// Find the first markdown H1 (`# Title`) that sits OUTSIDE a fenced
// code block. Naive regex match would pick `# Clone…` inside a
// ```bash fence as the title and inject the badge there — a real bug
// observed in the wild. Returns the byte offset right after the H1
// line so the caller can splice in content. Returns null when no
// H1-outside-fence exists (caller prepends).
const findFirstH1End = (content: string): number | null => {
  let inFence = false;
  let pos = 0;
  for (const rawLine of content.split("\n")) {
    if (rawLine.startsWith("```")) inFence = !inFence;
    else if (!inFence && /^# .+$/.test(rawLine)) {
      return pos + rawLine.length;
    }
    pos += rawLine.length + 1; // +1 for the \n we split on
  }
  return null;
};

// Insert the badge block right under the first H1 line when no badge
// markers exist. If markers exist, leave alone (--force overwrites)
// — same three-state model as the main block, so deleting the markers
// keeps the badge gone until the user re-runs `install --force`.
const insertBadgeUnderTitle = (
  content: string,
  remote: string | null,
  force: boolean,
): string => {
  if (!remote) return content;
  const block = renderBadgeBlock(remote);
  const hasMarkers = content.includes(BADGE_MARKER_START) && content.includes(BADGE_MARKER_END);
  if (hasMarkers) {
    if (!force) return content;
    return replaceBetween(content, BADGE_MARKER_START, BADGE_MARKER_END, block);
  }
  const cut = findFirstH1End(content);
  if (cut !== null) {
    return content.slice(0, cut) + "\n\n" + block + content.slice(cut);
  }
  // No markdown H1 outside code fences → prepend (README likely uses
  // HTML for the title block, e.g. `<p align="center">…</p>`).
  return block + "\n\n" + content;
};

const planReadme = (state: FsState, opts: PlanOptions): Action => {
  const abs = path.join(state.cwd, README_REL);
  const repoName = state.remote ? state.remote.split("/")[1] : path.basename(state.cwd);
  const remote = state.remote !== undefined ? state.remote : resolveRemote(state.cwd);
  const block = renderReadmeBlock();

  // Three-state model (per marker pair): README absent → create.
  // Markers present → leave alone. --force → overwrite between markers.
  // Badge block follows the same rules but lives under the H1; main
  // managed block follows existing append-at-end behaviour.
  if (state.readme === null) {
    return {
      kind: "write",
      path: abs,
      content: renderMinimalReadme(repoName, remote),
      reason: "creating README with managed block",
    };
  }

  const hasMain =
    state.readme.includes(README_MARKER_START) && state.readme.includes(README_MARKER_END);

  // Compose the next README content step by step so a single write
  // covers badge + main-block decisions.
  let next = insertBadgeUnderTitle(state.readme, remote, opts.force);

  if (hasMain && !opts.force) {
    if (next === state.readme) {
      return {
        kind: "noop",
        path: abs,
        content: state.readme,
        reason: "managed blocks present — leaving alone (--force to overwrite)",
      };
    }
    return {
      kind: "patch-readme",
      path: abs,
      content: next,
      reason: "adding badge under title",
    };
  }

  if (hasMain && opts.force) {
    next = replaceBetween(next, README_MARKER_START, README_MARKER_END, block);
    return {
      kind: "patch-readme",
      path: abs,
      content: next,
      reason: "force: overwriting managed blocks",
    };
  }

  // No main marker → append the main block at end.
  const separator = next.endsWith("\n") ? "\n" : "\n\n";
  return {
    kind: "patch-readme",
    path: abs,
    content: next + separator + block + "\n",
    reason: "appending managed block",
  };
};

export const plan = (state: FsState, opts: PlanOptions = { force: false }): Action[] => [
  planWorkflow(state, opts),
  planReadme(state, opts),
];

export const allNoop = (actions: Action[]): boolean => actions.every((a) => a.kind === "noop");
