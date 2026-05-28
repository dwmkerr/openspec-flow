// Exhaustive handler registry keyed by Intent["kind"]. Mapped-type
// Record forces every kind in the discriminated union to appear here:
// adding a new variant to Intent without updating this file fails tsc.
//
// Real entries are async functions invoked by the dispatcher. `null`
// is the explicit "classified but not implemented" sentinel — the
// dispatcher updates the sticky status comment with a terminal
// failure line instead of silently dropping the intent.

import type { Intent } from "../intent.js";
import { handleCreateSpec } from "./create-spec/index.js";
import { handleCreateImpl } from "./create-impl/index.js";
import { handleIterateSpec } from "./iterate-spec/index.js";
import { handleIterateImpl } from "./iterate-impl/index.js";
import type { RunAgentLogger } from "../agent/run.js";
import type { MinimalOctokit } from "./create-impl/index.js";

export interface HandlerCtx {
  owner: string;
  repo: string;
  octokit: MinimalOctokit;
  gitPushToken: string;
  log: RunAgentLogger;
  statusCommentId?: number;
  statusTargetNumber?: number;
}

export type IntentKind = Intent["kind"];
export type Handler<K extends IntentKind> = (
  intent: Extract<Intent, { kind: K }>,
  ctx: HandlerCtx,
) => Promise<unknown>;

// Mapped-type Record: omit a kind and tsc will error with
// "Property '<kind>' is missing in type ...".
export const HANDLERS: { [K in IntentKind]: Handler<K> | null } = {
  "create-spec": (i, c) =>
    handleCreateSpec({
      ...c,
      issueNumber: i.issueNumber,
      issueTitle: i.title,
    }),

  "create-impl": (i, c) =>
    handleCreateImpl({
      ...c,
      mode: "sequential",
      specPrNumber: i.specPrNumber,
    }),

  "iterate-spec": (i, c) =>
    handleIterateSpec({
      ...c,
      specPrNumber: i.prNumber,
    }),

  "iterate-impl": (i, c) =>
    handleIterateImpl({
      ...c,
      implPrNumber: i.prNumber,
    }),

  // noop is fully handled by the dispatcher's visible/silent branch
  // before lookup. It exists here only to satisfy exhaustiveness.
  noop: null,
};

// Type-safe lookup helper. Returns the handler typed against the
// narrowed intent variant, so the dispatcher doesn't need an
// `as never` cast at the call site.
export const dispatchTo = async (
  intent: Intent,
  ctx: HandlerCtx,
): Promise<{ dispatched: true } | { dispatched: false; kind: IntentKind }> => {
  // Cast is sound by construction: HANDLERS[K] returns Handler<K>|null
  // where the argument type is Extract<Intent, {kind: K}>, which is
  // exactly the runtime narrowing TS would derive from a switch.
  const handler = HANDLERS[intent.kind] as Handler<typeof intent.kind> | null;
  if (handler === null) {
    return { dispatched: false, kind: intent.kind };
  }
  await handler(intent as Extract<Intent, { kind: typeof intent.kind }>, ctx);
  return { dispatched: true };
};
