import type { Context, Probot } from "probot";
import { Intent, classify, describe } from "./intent.js";
import { runDispatch } from "./dispatch.js";
import { dispatchMode } from "./config.js";
import { runAppInit } from "./app-install/index.js";

// openspec-flow Probot entry point.
//
// Classify every relevant webhook event into a typed Intent, then dispatch
// through the shared core in src/dispatch.ts. The GitHub Action mode reaches
// the same core via `openspec-flow dispatch`. Actionable + visible-noop
// intents post a sticky status comment; silent noops log only.

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
  const mode = dispatchMode();
  app.log.info(`openspec-flow Probot booted`);
  app.log.info(`dispatch-mode=${mode}`);

  for (const name of EVENTS) {
    app.on(name, async (context) => {
      // In-proc event dispatch is dev-only. In `action` mode the shim
      // workflow in the user's repo handles these events; Probot
      // staying out of the way prevents double-fire.
      if (dispatchMode() !== "in-process") return;
      const intent = classify(context.name, context.payload as unknown);
      await dispatch(intent, context);
    });
  }

  // Install bootstrap — opens the per-repo init PR on first install.
  // Ignores DISPATCH_MODE because only Probot can see this event.
  app.on("installation.created", async (context) => {
    await handleInstallationCreated(context);
  });
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

// Probot adapter over the shared dispatch core. Handles the silent-noop
// log shortcut and structured intent logging here (per-adapter concerns),
// then builds DispatchDeps from the webhook Context and delegates.
const dispatch = async (
  intent: Intent,
  context: Context<(typeof EVENTS)[number]>,
): Promise<void> => {
  // Silent noops collapse to a single line so the actionable events
  // stand out in the dev pane.
  if (intent.kind === "noop" && !intent.visible) {
    const p = context.payload as any;
    const event = `${context.name}.${p?.action ?? "?"}`;
    context.log.info(`noop — ${intent.reason} (${event})${targetTag(p)}`);
    return;
  }

  context.log.info(
    { ...eventContext(context), intent: intent.kind, summary: describe(intent) },
    "intent",
  );

  if (!isActionable(intent)) return;

  const issueNumber = targetNumber(context.payload);
  if (issueNumber === null) {
    context.log.warn("actionable intent but no issue/PR number on payload");
    return;
  }

  // Handler-scoped log uses the root logger so streamed agent chunks
  // aren't tagged with the webhook delivery id (which would multiply
  // by ~50 lines per intent and obscure the actual reasoning).
  const handlerLog = rootLog ?? context.log;

  await runDispatch(intent, {
    octokit: context.octokit as any,
    owner: context.repo().owner,
    repo: context.repo().repo,
    targetNumber: issueNumber,
    log: {
      info: (m: string) => handlerLog.info(m),
      warn: (m: string) => handlerLog.warn(m),
    },
    getToken: async () => {
      const auth = (await context.octokit.auth({ type: "installation" })) as {
        token?: string;
      };
      const token = auth?.token;
      if (!token) throw new Error("could not obtain installation token");
      return token;
    },
    // Keep delivery correlation on the failure record via context.log.
    logError: (msg, err) =>
      context.log.error({ ...eventContext(context), err: err.message }, msg),
  });
};

// On install, open a setup PR in each newly-attached repo. Serial so
// a rate-limit on repo N doesn't abort N+1; per-repo errors are
// logged-and-swallowed for the same reason.
const handleInstallationCreated = async (
  context: Context<"installation.created">,
): Promise<void> => {
  const payload = context.payload as any;
  const account = payload?.installation?.account?.login ?? "?";
  const repos: { name: string }[] = payload?.repositories ?? [];
  context.log.info(
    `installation.created — account=${account} repos=${repos.length}`,
  );
  const log = {
    info: (m: string) => context.log.info(m),
    warn: (m: string) => context.log.warn(m),
  };
  for (const r of repos) {
    try {
      await runAppInit(
        { octokit: context.octokit as any, log },
        { owner: account, name: r.name },
        { dryRun: false },
      );
    } catch (err: any) {
      const status = err?.status;
      const remaining = err?.response?.headers?.["x-ratelimit-remaining"];
      if (status === 403 && remaining === "0") {
        context.log.warn(`${account}/${r.name}: rate-limited; continuing`);
        continue;
      }
      context.log.error(
        { err: err?.message ?? String(err) },
        `${account}/${r.name}: app-init failed`,
      );
    }
  }
};
