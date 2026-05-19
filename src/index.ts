import type { Context, Probot } from "probot";
import { Intent, classify, describe } from "./intent.js";

// openspec-flow Probot entry point.
//
// Classify every relevant webhook event into a typed Intent, then dispatch.
// Actionable + visible-noop intents post a comment on the target issue/PR;
// silent noops log only. Production logic for each intent lives in
// .github/actions/openspec-flow-* — port them in as later changes.

// Events we subscribe to. Anything not listed here doesn't reach us.
const EVENTS = [
  "issues",
  "pull_request",
  "issue_comment",
  "pull_request_review",
  "pull_request_review_comment",
  "check_suite",
  "workflow_run",
] as const;

export default (app: Probot): void => {
  app.log.info("openspec-flow Probot booted");

  for (const name of EVENTS) {
    app.on(name, async (context) => {
      const intent = classify(context.name, context.payload as unknown);
      await dispatch(intent, context);
    });
  }
};

const isActionable = (intent: Intent): boolean =>
  intent.kind !== "noop" || intent.visible;

const targetNumber = (payload: any): number | null =>
  payload?.issue?.number ?? payload?.pull_request?.number ?? null;

const targetKind = (payload: any): "issue" | "pr" | null => {
  if (payload?.pull_request !== undefined) return "pr";
  if (payload?.issue !== undefined) return "issue";
  return null;
};

const eventContext = (
  context: Context<(typeof EVENTS)[number]>,
): Record<string, unknown> => {
  const p = context.payload as any;
  const tNum = targetNumber(p);
  const tKind = targetKind(p);
  const target = tNum !== null && tKind !== null ? `${tKind} #${tNum}` : "(none)";
  return {
    event: `${context.name}.${p?.action ?? "?"}`,
    repo: `${context.repo().owner}/${context.repo().repo}`,
    target,
    label: p?.label?.name ?? undefined,
    sender: p?.sender?.login ? `${p.sender.login} (${p.sender.type})` : undefined,
  };
};

const dispatch = async (
  intent: Intent,
  context: Context<(typeof EVENTS)[number]>,
): Promise<void> => {
  const summary = describe(intent);
  context.log.info(
    { ...eventContext(context), intent: intent.kind, summary },
    "intent",
  );

  if (!isActionable(intent)) return;

  const issueNumber = targetNumber(context.payload);
  if (issueNumber === null) {
    context.log.warn("actionable intent but no issue/PR number on payload");
    return;
  }

  const body =
    intent.kind === "noop"
      ? `${summary}`
      : `**Intent:** ${summary}\n\n_Phase 2 will wire this to the agent. For now this is just the intent classifier confirming what would happen._`;

  await context.octokit.issues.createComment({
    owner: context.repo().owner,
    repo: context.repo().repo,
    issue_number: issueNumber,
    body,
  });
};
