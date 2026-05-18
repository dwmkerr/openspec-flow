import { Probot } from "probot";
import { Intent, describe } from "./intent.js";

// openspec-flow Probot entry point.
//
// Phase 1: log every relevant event so we can see what GitHub is sending
// during the two-terminal dev loop. Handlers below stub the real flow;
// production logic lives in the composite actions under
// .github/actions/openspec-flow-* — port them in as Phase 2 work.
export default (app: Probot): void => {
  app.log.info("openspec-flow Probot booted");

  // Trigger: user labels an issue with openspec:go → open a spec PR.
  app.on("issues.labeled", async (context) => {
    const label = context.payload.label?.name;
    if (label !== "openspec:go") {
      context.log.debug({ label }, "ignoring non-trigger label");
      return;
    }
    const { number, title, pull_request } = context.payload.issue;
    const isPR = pull_request !== undefined;
    const labels = context.payload.issue.labels.map((l) => l.name);

    let intent: Intent;
    if (!isPR) {
      intent = { kind: "create-spec", issueNumber: number, title };
    } else if (labels.includes("openspec:spec")) {
      intent = { kind: "iterate-spec", prNumber: number };
    } else if (labels.includes("openspec:impl")) {
      intent = { kind: "iterate-impl", prNumber: number };
    } else {
      intent = { kind: "noop", reason: "openspec:go on PR with no spec/impl label" };
    }

    context.log.info({ intent: intent.kind, summary: describe(intent) }, "intent");

    await context.octokit.issues.createComment(
      context.issue({
        body: `**Intent:** ${describe(intent)}\n\n_Phase 2 will wire this to the agent. For now this is just the intent classifier confirming what would happen._`,
      }),
    );
  });

  // User comments on a spec PR or impl PR → iterate.
  app.on("issue_comment.created", async (context) => {
    if (context.payload.sender.type === "Bot") return;
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
