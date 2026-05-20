import type { Context, Probot } from "probot";
import { Intent, classify, describe } from "./intent.js";
import { handleCreateSpec } from "./handlers/create-spec/index.js";

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

// Crop a title to keep noop log lines scannable in a narrow terminal.
const cropTitle = (t: string | undefined, max = 40): string => {
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

// Compact `[#N "title"]` suffix for noop one-liners; falls back to
// `[#N]` when no title is available, or "" when there's no target.
const targetTag = (payload: any): string => {
  const num = targetNumber(payload);
  if (num === null) return "";
  const title = cropTitle(payload?.issue?.title ?? payload?.pull_request?.title);
  return title ? ` [#${num} "${title}"]` : ` [#${num}]`;
};

const dispatch = async (
  intent: Intent,
  context: Context<(typeof EVENTS)[number]>,
): Promise<void> => {
  const summary = describe(intent);

  // Silent noops collapse to a single line so the actionable events
  // stand out in the dev pane. Actionable + visible-noop intents keep
  // the rich multi-line structured log for debugging.
  if (intent.kind === "noop" && !intent.visible) {
    const p = context.payload as any;
    const event = `${context.name}.${p?.action ?? "?"}`;
    context.log.info(`noop — ${intent.reason} (${event})${targetTag(p)}`);
    return;
  }

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

  // Eyes reaction is the fast deterministic ack. Comment follows as the
  // substantive ack. Reaction is best-effort — never blocks the comment.
  await reactEyes(context, issueNumber);

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

  // Route actionable intents to their handlers. Handlers are bounded
  // best-effort: errors are caught and logged so a logic bug never
  // crashes the webhook (Probot would otherwise retry on throw).
  if (intent.kind === "create-spec") {
    try {
      await handleCreateSpec({
        issueNumber: intent.issueNumber,
        issueTitle: intent.title,
        log: {
          info: (m: string) => context.log.info(m),
          warn: (m: string) => context.log.warn(m),
        },
      });
    } catch (err) {
      context.log.error(
        { ...eventContext(context), err: (err as Error).message },
        "create-spec handler failed",
      );
    }
  }
};

const reactEyes = async (
  context: Context<(typeof EVENTS)[number]>,
  issueNumber: number,
): Promise<void> => {
  try {
    await context.octokit.reactions.createForIssue({
      owner: context.repo().owner,
      repo: context.repo().repo,
      issue_number: issueNumber,
      content: "eyes",
    });
  } catch (err) {
    context.log.warn(
      { ...eventContext(context), err: (err as Error).message },
      "eyes reaction failed",
    );
  }
};
