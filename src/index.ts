import type { Context, Probot } from "probot";
import { Intent, classify, describe } from "./intent.js";
import { runDispatch } from "./dispatch.js";
import { dispatchMode } from "./config.js";
import { runAppInit } from "./app-install/index.js";
import { addEyes, removeEyes } from "./reactions.js";
import { upsertImplBreadcrumb } from "./handlers/shared/issue-breadcrumb.js";
import { upsertStickyComment } from "./handlers/shared/sticky-status.js";
import { statusReceived } from "./handlers/shared/status-bodies.js";
import { handleTokenRequest } from "./oidc-broker/route.js";
import type { InstallationTokenIssuer } from "./oidc-broker/index.js";
import express from "express";

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

// Probot v13's app function takes options as a second arg, including
// the `getRouter` factory we need to mount the OIDC broker route.
interface AppOptions {
  getRouter?: (path?: string) => import("express").Router;
}

export default (app: Probot, options: AppOptions = {}): void => {
  rootLog = app.log;
  const mode = dispatchMode();
  app.log.info(`openspec-flow Probot booted`);
  app.log.info(`dispatch-mode=${mode}`);

  for (const name of EVENTS) {
    app.on(name, async (context) => {
      const intent = classify(context.name, context.payload as unknown);

      // Fast 👀 ack runs BEFORE the dispatch-mode gate. The gate
      // scopes dispatch, not acknowledgement — App-installed repos
      // should see sub-second eyes even when the shim does the work.
      // Restricted to label-driven actionable intents so noise labels
      // don't trigger eyes.
      await maybeAddEyes(intent, context);

      // Issue early breadcrumb for create-impl. Sticky comment for
      // this intent lives on the spec PR, leaving the originating
      // issue silent for 30+ seconds until the workflow runner spins
      // up. Posting now gives the issue a visible signal that work
      // started; the workflow's create-impl handler upserts the same
      // marker later with the run link + progress states.
      await maybeBreadcrumbImplStart(intent, context);

      // Sticky status comment pre-gate. Workflow's runDispatch upserts
      // the same marker ~30s later when the runner spins up. Without
      // this pre-gate post, the target issue/PR sits silent during
      // runner spinup; with it, the user sees `openspec-flow received:
      // <intent>. Starting…` within ~1s of labeling.
      await maybeAddStickyReceived(intent, context);

      // In-proc event dispatch is dev-only. In `action` mode the shim
      // workflow in the user's repo handles these events; Probot
      // staying out of the way prevents double-fire.
      if (dispatchMode() !== "in-process") return;
      await dispatch(intent, context);
    });
  }

  // Install bootstrap — opens the per-repo init PR on first install.
  // Ignores DISPATCH_MODE because only Probot can see this event.
  app.on("installation.created", async (context) => {
    await handleInstallationCreated(context);
  });

  // Same bootstrap for repos added to an existing installation. The
  // payload uses `repositories_added` instead of `repositories`; the
  // per-repo work (init PR + label provisioning) is identical, so we
  // adapt the payload shape and reuse the existing handler logic.
  app.on("installation_repositories.added", async (context) => {
    const payload = context.payload as any;
    const account = payload?.installation?.account?.login ?? "?";
    const added: { name: string }[] = payload?.repositories_added ?? [];
    context.log.info(
      `installation_repositories.added — account=${account} repos=${added.length}`,
    );
    // Build a synthetic installation.created-shaped payload so the
    // handler can be shared verbatim. Avoids two near-identical loops.
    const synthetic = {
      ...context,
      payload: {
        ...payload,
        repositories: added,
      },
    } as unknown as Context<"installation.created">;
    await handleInstallationCreated(synthetic);
  });

  // Uninstall events — log only. Useful while debugging install/UI
  // flows: shows the App seeing the off-cycle.
  app.on("installation.deleted", async (context) => {
    const p = context.payload as any;
    const account = p?.installation?.account?.login ?? "?";
    const repos: { name: string }[] = p?.repositories ?? [];
    context.log.info(
      `installation.deleted — account=${account} repos=${repos.map((r) => r.name).join(",") || "(none in payload)"}`,
    );
  });

  app.on("installation_repositories.removed", async (context) => {
    const p = context.payload as any;
    const account = p?.installation?.account?.login ?? "?";
    const removed: { name: string }[] = p?.repositories_removed ?? [];
    context.log.info(
      `installation_repositories.removed — account=${account} repos=${removed.map((r) => r.name).join(",") || "(none)"}`,
    );
  });

  // Workflow-completion cleanup for the App's fast 👀: removes the
  // reaction once the shim workflow finishes (success or failure) so
  // the issue/PR doesn't keep a stale ack across iterations. Idempotent
  // with the dispatch-core's own finally-remove.
  app.on("workflow_run.completed", async (context) => {
    await handleWorkflowRunCompleted(context);
  });

  // OIDC token broker — POST /api/token. Workflow runners exchange a
  // GitHub-issued OIDC ID token for a fresh App installation token
  // so target repos never need the App's private key as a secret.
  // The route is only registered when the broker audience is
  // configured; absent OPENSPEC_FLOW_BROKER_AUDIENCE it's a no-op.
  const audience = process.env.OPENSPEC_FLOW_BROKER_AUDIENCE;
  if (audience && options.getRouter) {
    const router = options.getRouter("/api");
    router.use(express.json());
    const issuer = buildBrokerIssuer(app);
    const log = {
      info: (m: string) => app.log.info(m),
      warn: (m: string) => app.log.warn(m),
    };
    router.post(
      "/token",
      handleTokenRequest({ config: { audience }, issuer, log }),
    );
    app.log.info(`oidc-broker mounted at /api/token (audience=${audience})`);
  } else {
    app.log.info("oidc-broker disabled (set OPENSPEC_FLOW_BROKER_AUDIENCE to enable)");
  }
};

// Build the InstallationTokenIssuer used by the broker. Wraps
// Probot's auth surface so we don't duplicate the App-JWT plumbing
// that already lives there.
const buildBrokerIssuer = (app: Probot): InstallationTokenIssuer => ({
  getInstallationId: async (owner, repo) => {
    // App-level Octokit (no installation id) — uses the App JWT, not
    // an installation token, so it can call the per-repo install
    // lookup endpoint.
    const appOctokit = await (app as any).auth();
    const res = await appOctokit.request(
      "GET /repos/{owner}/{repo}/installation",
      { owner, repo },
    );
    return res.data.id as number;
  },
  mintToken: async (installationId) => {
    // Probot's auth(installationId) returns an Octokit pre-authed
    // as that installation. The underlying auth strategy exposes a
    // token via .auth({type:"installation"}) — same trick the
    // dispatch path uses to get a push token.
    const installOctokit = await (app as any).auth(installationId);
    const auth = (await installOctokit.auth({ type: "installation" })) as {
      token: string;
      expiresAt: string;
    };
    return { token: auth.token, expiresAt: auth.expiresAt };
  },
});

// Intents that originate from a user adding `openspec:go` — the only
// trigger we want to acknowledge with 👀. Same allowlist is used for
// the bot-pre-gate sticky comment (create-impl is added separately
// because its sticky lives on the spec PR, which is also the merge
// event's target — same gating predicate, different intent kind).
const eyeAckIntents = new Set(["create-spec", "iterate-spec", "iterate-impl"]);
const stickyPreGateIntents = new Set([
  "create-spec",
  "iterate-spec",
  "iterate-impl",
  "create-impl",
]);

const maybeAddStickyReceived = async (
  intent: Intent,
  context: Context<(typeof EVENTS)[number]>,
): Promise<void> => {
  if (!stickyPreGateIntents.has(intent.kind)) return;
  const num = targetNumber(context.payload);
  if (num === null) return;
  const summary = describe(intent);
  const body = statusReceived(summary);
  await upsertStickyComment(
    context.octokit as any,
    context.repo().owner,
    context.repo().repo,
    num,
    intent.kind,
    body,
    { warn: (m: string) => context.log.warn(m) },
  );
};

const maybeBreadcrumbImplStart = async (
  intent: Intent,
  context: Context<(typeof EVENTS)[number]>,
): Promise<void> => {
  if (intent.kind !== "create-impl") return;
  if (intent.issueNumber === null) return;
  await upsertImplBreadcrumb(
    context.octokit as any,
    context.repo().owner,
    context.repo().repo,
    intent.issueNumber,
    intent.specPrNumber,
    { kind: "starting" },
    { warn: (m: string) => context.log.warn(m) },
  );
};

const maybeAddEyes = async (
  intent: Intent,
  context: Context<(typeof EVENTS)[number]>,
): Promise<void> => {
  if (!eyeAckIntents.has(intent.kind)) return;
  const num = targetNumber(context.payload);
  if (num === null) return;
  await addEyes(
    context.octokit as any,
    context.repo().owner,
    context.repo().repo,
    num,
    { warn: (m: string) => context.log.warn(m) },
  );
};

// Match the branch conventions written by the create-spec / create-impl
// handlers. Heads like `chore/42-add-export` or `feat/42-add-export`
// carry the originating issue number in the second segment.
const ISSUE_FROM_BRANCH = /^(?:chore|feat)\/(\d+)-/;

const handleWorkflowRunCompleted = async (
  context: Context<"workflow_run.completed">,
): Promise<void> => {
  const run = (context.payload as any)?.workflow_run;
  if (!run || run.name !== "openspec-flow") return;
  const branch: string | undefined = run.head_branch;
  if (!branch) return;
  const match = branch.match(ISSUE_FROM_BRANCH);
  if (!match) return;
  const issueNumber = Number(match[1]);
  await removeEyes(
    context.octokit as any,
    context.repo().owner,
    context.repo().repo,
    issueNumber,
    { warn: (m: string) => context.log.warn(m) },
  );
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
