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

  // Three-state model: README absent → create. Marker present →
  // leave alone (user owns it once injected; we don't second-guess).
  // --force → overwrite content between markers, or re-append if
  // the user has deleted them.
  if (state.readme === null) {
    return {
      kind: "write",
      path: abs,
      content: renderMinimalReadme(repoName),
      reason: "creating README with managed block",
    };
  }

  const hasMarkers =
    state.readme.includes(README_MARKER_START) && state.readme.includes(README_MARKER_END);

  if (hasMarkers && !opts.force) {
    return {
      kind: "noop",
      path: abs,
      content: state.readme,
      reason: "managed block present — leaving alone (--force to overwrite)",
    };
  }

  if (hasMarkers && opts.force) {
    return {
      kind: "patch-readme",
      path: abs,
      content: replaceBetween(state.readme, README_MARKER_START, README_MARKER_END, block),
      reason: "force: overwriting managed block",
    };
  }

  // No markers. First run on an existing README → append.
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
