// Single sticky comment for an issue. One comment lives across the
// whole flow, mutated through every state. The Probot adapter
// (pre-gate) and the workflow's dispatch core call
// `renderLifecycleSticky` then upsert by marker.
//
// Design conventions (locked in conversation):
//   - One descriptive headline = "where am I + what do I do next".
//     No separate call-to-action footer.
//   - Verbs are `preparing` (pre-gate, no run yet), `creating` (first
//     pass), and `iterating` (re-run after a comment + openspec:go).
//   - Workflow link lives in the table row, not in the headline.
//   - Hyphens, not em-dashes.
//   - Phase names in headlines say "specification" / "implementation"
//     (full words). In the table they say "Spec" / "Implementation".
//   - PR references render as explicit markdown links so any markdown
//     renderer (preview + production) shows them as hyperlinks.
//   - Warning sigil only used on failure headlines.

const REPO_URL = "https://github.com/dwmkerr/openspec-flow";
const DOCS_URL = "https://github.com/dwmkerr/openspec-flow#readme";

const WORKING_GIF_URL =
  "https://raw.githubusercontent.com/dwmkerr/openspec-flow/main/assets/openspec-flow-working.gif";

// 24px = inline-punctuation-sized, doesn't push the table off to the
// right. Used only in active-state headlines.
const GIF_HTML = `<img src="${WORKING_GIF_URL}" width="24" align="absmiddle" alt="working" />`;

export const stickyMarkerFor = (issueNumber: number): string =>
  `<!-- openspec-flow:sticky issue=${issueNumber} -->`;

// State marker. Embedded as a separate hidden HTML comment so the
// lookup marker stays clean and substring-stable. Readers extract
// the JSON-base64 payload; writers regenerate it each upsert.
const STATE_MARKER_PREFIX = "<!-- openspec-flow:sticky-state ";
const STATE_MARKER_SUFFIX = " -->";

const encodeState = (state: LifecycleStickyState): string =>
  Buffer.from(JSON.stringify(state), "utf8").toString("base64");

const decodeState = (encoded: string): LifecycleStickyState | null => {
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    return null;
  }
};

const stateMarkerFor = (state: LifecycleStickyState): string =>
  `${STATE_MARKER_PREFIX}${encodeState(state)}${STATE_MARKER_SUFFIX}`;

// Reverse of stateMarkerFor — given a comment body, pull out the
// embedded LifecycleStickyState if present. Multiple writers can each
// read the current state, mutate one field, and write the result back
// without having to maintain global state in memory.
export const parseStateFromBody = (
  body: string,
): LifecycleStickyState | null => {
  const start = body.indexOf(STATE_MARKER_PREFIX);
  if (start === -1) return null;
  const after = start + STATE_MARKER_PREFIX.length;
  const end = body.indexOf(STATE_MARKER_SUFFIX, after);
  if (end === -1) return null;
  return decodeState(body.slice(after, end));
};

// Per-phase row state.
export type RowState =
  | { kind: "not-started" }
  | { kind: "preparing" }
  | { kind: "creating"; run?: ActiveRun }
  | { kind: "pr-open"; prNumber: number }
  | { kind: "pr-iterating"; prNumber: number; run?: ActiveRun }
  | { kind: "pr-merged"; prNumber: number }
  | { kind: "failed" };

export interface ActiveRun {
  number: number;
  url: string;
}

export interface LifecycleStickyState {
  // GitHub `owner/repo`. Needed to render PR refs as full URLs so
  // they hyperlink in any markdown renderer.
  repo: { owner: string; name: string };
  spec: RowState;
  implementation: RowState;
  // Failure context — overlays as the headline + sets the row to
  // `failed`. Caller is responsible for setting the row.
  failure?: {
    phase: "spec" | "implementation";
    reason: string;
    run?: ActiveRun;
  };
}

const prUrl = (owner: string, repo: string, prNumber: number): string =>
  `https://github.com/${owner}/${repo}/pull/${prNumber}`;

const prLink = (state: LifecycleStickyState, n: number): string =>
  `[#${n}](${prUrl(state.repo.owner, state.repo.name, n)})`;

const runLink = (run?: ActiveRun): string =>
  run ? ` in [workflow #${run.number}](${run.url})` : "";

const phaseHeading = (phase: "spec" | "implementation"): string =>
  phase === "spec" ? "the specification" : "the implementation";

const renderRow = (
  label: string,
  row: RowState,
  state: LifecycleStickyState,
): string => {
  let value: string;
  switch (row.kind) {
    case "not-started":
      value = "not started";
      break;
    case "preparing":
      value = "preparing";
      break;
    case "creating":
      value = `creating${runLink(row.run)}`;
      break;
    case "pr-open":
      value = `PR ${prLink(state, row.prNumber)} - open`;
      break;
    case "pr-iterating":
      value = `PR ${prLink(state, row.prNumber)} - iterating${runLink(row.run)}`;
      break;
    case "pr-merged":
      value = `PR ${prLink(state, row.prNumber)} - merged`;
      break;
    case "failed":
      value = "failed";
      break;
  }
  return `| ${label} | ${value} |`;
};

const renderTable = (state: LifecycleStickyState): string => {
  return [
    "| Phase | Status |",
    "|---|---|",
    renderRow("Spec", state.spec, state),
    renderRow("Implementation", state.implementation, state),
  ].join("\n");
};

const completed = (state: LifecycleStickyState): boolean =>
  state.spec.kind === "pr-merged" && state.implementation.kind === "pr-merged";

// Single descriptive headline. Workflow link lives in the table, NOT
// here, so this stays short.
const headline = (state: LifecycleStickyState): string => {
  if (state.failure) {
    const reason = state.failure.reason ? ` - ${state.failure.reason}` : "";
    return `⚠️ Run failed during ${state.failure.phase === "spec" ? "spec" : "implementation"}${reason}. Add the \`openspec:go\` label to retry once the cause is fixed.`;
  }

  if (completed(state)) return "Completed.";

  // Pre-gate: agent hasn't started yet, no run id.
  if (state.spec.kind === "preparing") {
    return `${GIF_HTML} openspec-flow is preparing to create the specification.`;
  }
  if (state.implementation.kind === "preparing") {
    return `${GIF_HTML} openspec-flow is preparing to create the implementation.`;
  }

  // Active phase: creating or iterating.
  if (state.spec.kind === "creating") {
    return `${GIF_HTML} openspec-flow is creating the specification.`;
  }
  if (state.implementation.kind === "creating") {
    return `${GIF_HTML} openspec-flow is creating the implementation.`;
  }
  if (state.spec.kind === "pr-iterating") {
    return `${GIF_HTML} openspec-flow is iterating on the specification.`;
  }
  if (state.implementation.kind === "pr-iterating") {
    return `${GIF_HTML} openspec-flow is iterating on the implementation.`;
  }

  // Awaiting review states.
  if (state.spec.kind === "pr-open" && state.implementation.kind === "not-started") {
    const ref = prLink(state, state.spec.prNumber);
    return `Awaiting review of spec PR ${ref}. Merge it to trigger the implementation, or comment and apply the \`openspec:go\` label on the PR to iterate.`;
  }
  if (state.implementation.kind === "pr-open" && state.spec.kind === "pr-merged") {
    const ref = prLink(state, state.implementation.prNumber);
    return `Awaiting review of implementation PR ${ref}. Merge it to close this issue, or comment and apply the \`openspec:go\` label on the PR to iterate.`;
  }

  // Fallback — keep the comment renderable even on unexpected combos.
  return `${GIF_HTML} openspec-flow received the request.`;
};

const footer = (): string =>
  `<div align="right"><sub><a href="${REPO_URL}">openspec-flow</a> · <a href="${DOCS_URL}">docs</a></sub></div>`;

export const renderLifecycleSticky = (
  issueNumber: number,
  state: LifecycleStickyState,
): string => {
  return [
    "**openspec-flow**",
    "",
    headline(state),
    "",
    renderTable(state),
    "",
    footer(),
    "",
    stickyMarkerFor(issueNumber),
    stateMarkerFor(state),
  ].join("\n");
};

// Read-modify-write helper. Lists the issue's comments, finds the
// existing sticky (if any), parses its embedded state, calls mutator,
// renders, and upserts.
//
// `seedState` is used when no sticky exists yet — i.e. the first
// writer for this issue. Subsequent writers reuse what's already
// there. Callers can mutate any subset of fields; unknown fields are
// preserved across writes because the state is round-tripped.

import {
  upsertCommentByMarker,
  type UpsertOctokit,
  type UpsertLogger,
} from "./comment-upsert.js";

export const mutateLifecycleSticky = async (
  octokit: UpsertOctokit,
  owner: string,
  repo: string,
  issueNumber: number,
  seedState: LifecycleStickyState,
  mutator: (state: LifecycleStickyState) => LifecycleStickyState,
  log?: UpsertLogger,
): Promise<void> => {
  // Find the existing sticky to read its state. Cheap path: list
  // first page of comments + grep for our marker. Avoids a separate
  // "get state" round-trip ahead of the mutate-and-write.
  let current: LifecycleStickyState = seedState;
  try {
    const res = await octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      { owner, repo, issue_number: issueNumber, per_page: 100 },
    );
    const comments = (res.data ?? []) as { body: string }[];
    const lookup = stickyMarkerFor(issueNumber);
    for (const c of comments) {
      if (typeof c.body === "string" && c.body.includes(lookup)) {
        const parsed = parseStateFromBody(c.body);
        if (parsed) {
          current = parsed;
        }
        break;
      }
    }
  } catch (err) {
    log?.warn(
      `mutateLifecycleSticky: list failed; seeding from defaults: ${(err as Error).message}`,
    );
  }

  const next = mutator(current);
  const marker = stickyMarkerFor(issueNumber);
  const body = renderLifecycleSticky(issueNumber, next);
  await upsertCommentByMarker(octokit, owner, repo, issueNumber, marker, body, log);
};
