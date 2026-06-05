// Issue early breadcrumb for `create-impl`.
//
// The sticky status comment for create-impl lives on the spec PR, so
// the originating issue sees no activity from the moment the spec
// merges until the impl PR opens. This breadcrumb fills the gap with
// a single comment on the issue that says "impl run starting…" and
// (when the workflow knows it) carries a watch link to the run.
//
// Dual-write: App posts the first version pre-gate immediately on
// `pull_request.closed` merged + `openspec:spec` (no run URL yet
// because the workflow hasn't been triggered). When the workflow
// reaches the create-impl handler, it upserts via the same marker
// adding the run link + state mutations.

import { upsertCommentByMarker, type UpsertOctokit, type UpsertLogger } from "./comment-upsert.js";
import { renderRunLink } from "./run-link.js";

const markerFor = (issueNumber: number, specPrNumber: number): string =>
  `<!-- openspec-flow:issue-breadcrumb intent=create-impl issue=${issueNumber} spec-pr=${specPrNumber} -->`;

export type ImplBreadcrumbState =
  | { kind: "starting" }
  | { kind: "implementing"; changeName?: string }
  | { kind: "opened"; implPrNumber: number }
  | { kind: "failed"; reason: string };

// Render the body for a given state. Run link is appended via the
// shared renderer so the App's pre-gate post (no env) renders cleanly
// and the workflow's later upsert adds the watch line in lockstep.
export const renderImplBreadcrumb = (
  state: ImplBreadcrumbState,
  specPrNumber: number,
): string => {
  let line: string;
  switch (state.kind) {
    case "starting":
      line = `openspec-flow: impl run starting for spec PR #${specPrNumber}…`;
      break;
    case "implementing":
      line = `openspec-flow: implementing ${state.changeName ? `\`${state.changeName}\` ` : ""}for spec PR #${specPrNumber}…`;
      break;
    case "opened":
      line = `✅ openspec-flow: impl PR opened: #${state.implPrNumber}`;
      break;
    case "failed":
      line = `⚠️ openspec-flow: impl run failed — ${state.reason}`;
      break;
  }
  return `${line}${renderRunLink()}`;
};

export const upsertImplBreadcrumb = async (
  octokit: UpsertOctokit,
  owner: string,
  repo: string,
  issueNumber: number,
  specPrNumber: number,
  state: ImplBreadcrumbState,
  log?: UpsertLogger,
): Promise<void> => {
  const marker = markerFor(issueNumber, specPrNumber);
  const body = `${renderImplBreadcrumb(state, specPrNumber)}\n\n${marker}`;
  await upsertCommentByMarker(octokit, owner, repo, issueNumber, marker, body, log);
};
