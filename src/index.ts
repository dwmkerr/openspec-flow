import { Probot } from "probot";

/**
 * openspec-flow Probot entry point.
 *
 * Phase 1: log every relevant event so we can see what GitHub is sending
 * during the two-terminal dev loop. Handlers below stub the real flow —
 * the production logic lives in the composite actions under
 * `.github/actions/openspec-flow-*/`. Port them in as Phase 2 work.
 */
export default (app: Probot): void => {
  app.log.info("openspec-flow Probot booted");

  // Trigger: user labels an issue with openspec:go → open a spec PR.
  app.on("issues.labeled", async (context) => {
    const label = context.payload.label?.name;
    if (label !== "openspec:go") {
      context.log.debug({ label }, "ignoring non-trigger label");
      return;
    }
    const { number, title } = context.payload.issue;
    const { repo, owner } = context.repo();
    context.log.info({ owner, repo, number, title }, "openspec:go received");

    // TODO(phase-2): port the run-agent composite action's plan phase here.
    // For now, post a hello comment so we can see the loop end-to-end.
    await context.octokit.issues.createComment(
      context.issue({
        body:
          "👋 openspec-flow saw the `openspec:go` label. " +
          "Spec PR will open here once the handler is ported (Phase 2).",
      }),
    );
  });

  // User comments on a spec PR or impl PR → iterate.
  app.on("issue_comment.created", async (context) => {
    if (context.isBot) return;
    const isPR = context.payload.issue.pull_request !== undefined;
    const labels = context.payload.issue.labels.map((l) => l.name);
    if (!isPR) return;
    if (!labels.includes("openspec:spec") && !labels.includes("openspec:impl")) {
      return;
    }

    context.log.info(
      { number: context.payload.issue.number, labels },
      "comment on openspec PR",
    );

    // TODO(phase-2): re-run the agent against the PR's branch with the
    // new comment context.
  });

  // Inline code-review comment on PR diff.
  app.on("pull_request_review_comment.created", async (context) => {
    context.log.info(
      { number: context.payload.pull_request.number },
      "PR review comment",
    );
    // TODO(phase-2): same handler as issue_comment for openspec:* labelled PRs.
  });

  // Catch-all for visibility during dev.
  app.onAny(async (context) => {
    context.log.debug({ event: context.name }, "received event");
  });
};
