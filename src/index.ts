import type { Context, Probot } from "probot";
import { Intent, classify, describe } from "./intent.js";
import { handleCreateSpec } from "./handlers/create-spec/index.js";
import { handleCreateImpl } from "./handlers/create-impl/index.js";
import { handleIterateSpec } from "./handlers/iterate-spec/index.js";
import { createStatusComment } from "./handlers/shared/status-comment.js";

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

// Captured at boot so the dispatcher can hand it to handlers.
// Handlers stream long agent traces (one logger.info per chunk);
// pinning those to context.log would tag every line with the
// webhook delivery id, which is the wrong semantic — the chunks
// are handler-scoped, not request-scoped. Using app.log keeps the
// id on HTTP / intent classification logs (where it's useful for
// correlating with GitHub's webhook delivery page) but drops it
// from the agent stream.
let rootLog: Probot["log"] | undefined;

export default (app: Probot): void => {
  rootLog = app.log;
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

  // Eyes reaction is the fast deterministic ack. Reaction is
  // best-effort — never blocks the comment that follows.
  await reactEyes(context, issueNumber);

  // One sticky status comment per intent. Body mutates from
  // receipt → working → terminal state as the handler progresses.
  // Visible noops are terminal: the body is just the reason.
  const body =
    intent.kind === "noop"
      ? summary
      : `👀 openspec-flow received: ${summary}. Starting…`;

  let statusCommentId: number | undefined;
  try {
    statusCommentId = await createStatusComment(
      context.octokit as any,
      context.repo().owner,
      context.repo().repo,
      issueNumber,
      body,
    );
  } catch (err) {
    context.log.warn(
      { ...eventContext(context), err: (err as Error).message },
      "status comment create failed; handler will run without upsert",
    );
  }

  // Route actionable intents to their handlers. Handlers are bounded
  // best-effort: errors are caught and logged so a logic bug never
  // crashes the webhook (Probot would otherwise retry on throw).
  if (
    intent.kind === "create-spec" ||
    intent.kind === "create-impl" ||
    intent.kind === "iterate-spec"
  ) {
    try {
      // Mint an installation token so the handler can `git push` and
      // give the agent's Bash subprocess a GH_TOKEN for `gh issue view`.
      const auth = (await context.octokit.auth({ type: "installation" })) as {
        token?: string;
      };
      const token = auth?.token;
      if (!token) throw new Error("could not obtain installation token");

      // Handler-scoped log uses the root logger so streamed agent
      // chunks aren't tagged with the webhook delivery id (which
      // would multiply by ~50 lines per intent and obscure the
      // actual reasoning). Errors are still logged via context.log
      // below to keep delivery correlation on the failure record.
      const handlerLog = rootLog ?? context.log;
      const log = {
        info: (m: string) => handlerLog.info(m),
        warn: (m: string) => handlerLog.warn(m),
      };

      if (intent.kind === "create-spec") {
        await handleCreateSpec({
          owner: context.repo().owner,
          repo: context.repo().repo,
          issueNumber: intent.issueNumber,
          issueTitle: intent.title,
          octokit: context.octokit as any,
          gitPushToken: token,
          log,
          statusCommentId,
          statusTargetNumber: issueNumber,
        });
      } else if (intent.kind === "create-impl") {
        await handleCreateImpl({
          owner: context.repo().owner,
          repo: context.repo().repo,
          mode: "sequential",
          specPrNumber: intent.specPrNumber,
          octokit: context.octokit as any,
          gitPushToken: token,
          log,
          statusCommentId,
          statusTargetNumber: issueNumber,
        });
      } else {
        // iterate-spec
        await handleIterateSpec({
          owner: context.repo().owner,
          repo: context.repo().repo,
          specPrNumber: intent.prNumber,
          octokit: context.octokit as any,
          gitPushToken: token,
          log,
          statusCommentId,
          statusTargetNumber: issueNumber,
        });
      }
    } catch (err) {
      context.log.error(
        { ...eventContext(context), err: (err as Error).message },
        `${intent.kind} handler failed`,
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
