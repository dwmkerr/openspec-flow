// Pure planner: given the current filesystem state and flags, decide
// what writes (if any) `init` should perform. No I/O here so the
// planner is trivially unit-testable and the App-install handler
// will be able to reuse it against a remote tree.

import * as path from "node:path";
import {
  README_MARKER_END,
  README_MARKER_START,
  renderMinimalReadme,
  renderReadmeBlock,
  renderWorkflow,
} from "./templates.js";

export interface FsState {
  cwd: string;
  workflow: string | null;
  readme: string | null;
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
}

const WORKFLOW_REL = ".github/workflows/openspec-flow.yml";
const README_REL = "README.md";

const planWorkflow = (state: FsState, _opts: PlanOptions): Action => {
  const target = renderWorkflow();
  const abs = path.join(state.cwd, WORKFLOW_REL);
  if (state.workflow === null) {
    return { kind: "write", path: abs, content: target, reason: "creating shim" };
  }
  if (state.workflow === target) {
    return { kind: "noop", path: abs, content: state.workflow, reason: "matches template" };
  }
  // Hand-edited (or stale version). Don't clobber on a plain run.
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

const planReadme = (state: FsState, opts: PlanOptions): Action => {
  const abs = path.join(state.cwd, README_REL);
  const repoName = path.basename(state.cwd);
  const block = renderReadmeBlock();

  if (state.readme === null) {
    return {
      kind: "write",
      path: abs,
      content: renderMinimalReadme(repoName),
      reason: "creating README with managed block",
    };
  }

  const hasStart = state.readme.includes(README_MARKER_START);
  const hasEnd = state.readme.includes(README_MARKER_END);

  if (hasStart && hasEnd) {
    const updated = replaceBetween(state.readme, README_MARKER_START, README_MARKER_END, block);
    if (updated === state.readme) {
      return { kind: "noop", path: abs, content: state.readme, reason: "managed block already current" };
    }
    return {
      kind: "patch-readme",
      path: abs,
      content: updated,
      reason: "refreshing managed block",
    };
  }

  // Markers absent. First run on an existing README, or user has
  // taken over the section by deleting markers. Without --force we
  // only append if neither marker exists *and* the user hasn't seen
  // the block before — heuristic: if any part of the block's title
  // exists in the README, assume "user took over".
  const looksLikeUserTookOver = state.readme.includes("openspec-flow") && !opts.force;
  if (looksLikeUserTookOver) {
    return {
      kind: "noop",
      path: abs,
      content: state.readme,
      reason: "README mentions openspec-flow but markers are gone — leaving alone; re-run with --force to re-append",
    };
  }

  const separator = state.readme.endsWith("\n") ? "\n" : "\n\n";
  return {
    kind: "patch-readme",
    path: abs,
    content: state.readme + separator + block + "\n",
    reason: "appending managed block",
  };
};

export const plan = (state: FsState, opts: PlanOptions = { force: false }): Action[] => [
  planWorkflow(state, opts),
  planReadme(state, opts),
];

export const allNoop = (actions: Action[]): boolean => actions.every((a) => a.kind === "noop");
