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

// Per-phase row state. Active states (creating, pr-iterating) carry
// an optional `step` for the agent's current sub-state — phrases like
// `gathering context`, `implementing the change`, `pushing`. Rendered
// inline so a reader sees what's happening without clicking through
// to the workflow run.
export type RowState =
  | { kind: "not-started" }
  | { kind: "preparing" }
  | { kind: "creating"; run?: ActiveRun; step?: string }
  | { kind: "pr-open"; prNumber: number }
  | { kind: "pr-iterating"; prNumber: number; run?: ActiveRun; step?: string }
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

export interface RenderOptions {
  // The originating issue this sticky tracks. Required so the PR
  // variant can prepend the "Tracked on issue #N →" header.
  issueNumber: number;
  // Surface this comment lives on. `pr` variants prepend the
  // issue-link header; `issue` variants don't.
  audience: "issue" | "pr";
  // True when the openspec-flow App is installed and posted the
  // comment (or webhook-side mutator wrote it). False when only the
  // plain workflow path is active — surfaces a discreet install hint
  // in the footer pointing at faster updates.
  appInstalled: boolean;
}

const prUrl = (owner: string, repo: string, prNumber: number): string =>
  `https://github.com/${owner}/${repo}/pull/${prNumber}`;

const prLink = (state: LifecycleStickyState, n: number): string =>
  `[#${n}](${prUrl(state.repo.owner, state.repo.name, n)})`;

const runLink = (run?: ActiveRun): string =>
  run ? ` in workflow [#${run.number}](${run.url})` : "";

const phaseHeading = (phase: "spec" | "implementation"): string =>
  phase === "spec" ? "the specification" : "the implementation";

// Active rows include the optional `step` inline so the row carries
// "creating - gathering context in workflow #234" rather than just
// "creating in workflow #234". When step is omitted, falls back to
// the plain active phrase.
const stepSegment = (step?: string): string =>
  step ? ` - ${step}` : "";

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
      value = `creating${stepSegment(row.step)}${runLink(row.run)}`;
      break;
    case "pr-open":
      value = `PR ${prLink(state, row.prNumber)} - open`;
      break;
    case "pr-iterating":
      value = `PR ${prLink(state, row.prNumber)} - iterating${stepSegment(row.step)}${runLink(row.run)}`;
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
    renderRow("Specification", state.spec, state),
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
    return `⚠️ Run failed during ${state.failure.phase === "spec" ? "specification" : "implementation"}${reason}. Add the \`openspec:go\` label to retry once the cause is fixed.`;
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
    return `Awaiting review of specification PR ${ref}. Merge it to trigger the implementation, or comment and apply the \`openspec:go\` label on the PR to iterate.`;
  }
  if (state.implementation.kind === "pr-open" && state.spec.kind === "pr-merged") {
    const ref = prLink(state, state.implementation.prNumber);
    return `Awaiting review of implementation PR ${ref}. Merge it to close this issue, or comment and apply the \`openspec:go\` label on the PR to iterate.`;
  }

  // Fallback — keep the comment renderable even on unexpected combos.
  return `${GIF_HTML} openspec-flow received the request.`;
};

// Install hint surfaces below the table when the writer was the
// plain-workflow path (no App). Discreet — italic, single sentence,
// keeps the call-to-action visible without dominating.
const INSTALL_HINT =
  "_Install the [openspec-flow App](https://github.com/apps/openspec-flow) on this repository for real-time updates instead of every-workflow-run refreshes._";

const issueRef = (
  state: LifecycleStickyState,
  opts: RenderOptions,
): string =>
  opts.audience === "pr"
    ? `> Tracked on issue [#${opts.issueNumber}](https://github.com/${state.repo.owner}/${state.repo.name}/issues/${opts.issueNumber}) →`
    : "";

const footer = (): string =>
  `<div align="right"><sub><a href="${REPO_URL}">openspec-flow</a> · <a href="${DOCS_URL}">docs</a></sub></div>`;

// Lookup marker scope depends on audience: the issue sticky and the
// per-PR sticky live on different threads, so they need different
// lookup markers. State payload is identical (round-tripped).
const lookupMarker = (opts: RenderOptions, prNumber?: number): string =>
  opts.audience === "issue"
    ? stickyMarkerFor(opts.issueNumber)
    : `<!-- openspec-flow:sticky pr=${prNumber} issue=${opts.issueNumber} -->`;

export const renderLifecycleSticky = (
  state: LifecycleStickyState,
  opts: RenderOptions,
  prNumber?: number,
): string => {
  const headerLine = issueRef(state, opts);
  const sections: string[] = ["**openspec-flow**", ""];
  if (headerLine) sections.push(headerLine, "");
  sections.push(headline(state), "", renderTable(state), "");
  if (!opts.appInstalled) sections.push(INSTALL_HINT, "");
  sections.push(
    footer(),
    "",
    lookupMarker(opts, prNumber),
    stateMarkerFor(state),
  );
  return sections.join("\n");
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

// Read the current state from whichever surface already has it. We
// prefer the issue's sticky because that's where pre-gate writes
// land first; falls back to a PR sticky if that's all that exists.
const readCurrentState = async (
  octokit: UpsertOctokit,
  owner: string,
  repo: string,
  targetNumber: number,
  marker: string,
  log?: UpsertLogger,
): Promise<LifecycleStickyState | null> => {
  try {
    const res = await octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      { owner, repo, issue_number: targetNumber, per_page: 100 },
    );
    const comments = (res.data ?? []) as { body: string }[];
    for (const c of comments) {
      if (typeof c.body === "string" && c.body.includes(marker)) {
        return parseStateFromBody(c.body);
      }
    }
  } catch (err) {
    log?.warn(
      `readCurrentState: list failed on ${owner}/${repo}#${targetNumber}: ${(err as Error).message}`,
    );
  }
  return null;
};

export interface StickyTargets {
  // Always present. The originating issue.
  issueNumber: number;
  // Optional. PR numbers to mirror the sticky onto.
  prNumbers?: number[];
}

export interface MutateOptions {
  // True when the writer is the App (Probot pre-gate); false when
  // the plain workflow path is doing the write.
  appInstalled: boolean;
}

// Multi-target mutator. Reads current state from the issue sticky,
// applies the mutator, then renders + upserts to every surface
// (issue + any provided PRs). One write per surface; same state
// body modulo the audience + lookup marker.
//
// `seedState` is used only when no sticky exists yet anywhere.
export const mutateLifecycleStickyEverywhere = async (
  octokit: UpsertOctokit,
  owner: string,
  repo: string,
  targets: StickyTargets,
  seedState: LifecycleStickyState,
  mutator: (state: LifecycleStickyState) => LifecycleStickyState,
  options: MutateOptions,
  log?: UpsertLogger,
): Promise<void> => {
  const { issueNumber, prNumbers = [] } = targets;

  // Try to read from the issue first (canonical surface). If empty,
  // try each PR until something is found.
  const issueMarker = stickyMarkerFor(issueNumber);
  let current = await readCurrentState(octokit, owner, repo, issueNumber, issueMarker, log);
  if (!current) {
    for (const pr of prNumbers) {
      const prMarker = `<!-- openspec-flow:sticky pr=${pr} issue=${issueNumber} -->`;
      current = await readCurrentState(octokit, owner, repo, pr, prMarker, log);
      if (current) break;
    }
  }
  if (!current) current = seedState;

  const next = mutator(current);

  // Write to the issue first, then mirror to every PR.
  const issueBody = renderLifecycleSticky(next, {
    issueNumber,
    audience: "issue",
    appInstalled: options.appInstalled,
  });
  await upsertCommentByMarker(
    octokit,
    owner,
    repo,
    issueNumber,
    issueMarker,
    issueBody,
    log,
  );

  for (const pr of prNumbers) {
    const prMarker = `<!-- openspec-flow:sticky pr=${pr} issue=${issueNumber} -->`;
    const prBody = renderLifecycleSticky(
      next,
      { issueNumber, audience: "pr", appInstalled: options.appInstalled },
      pr,
    );
    await upsertCommentByMarker(octokit, owner, repo, pr, prMarker, prBody, log);
  }
};

// Single-target convenience wrapper for callers that only update the
// issue (Probot pre-gate before any PR exists). Equivalent to calling
// mutateLifecycleStickyEverywhere with no prNumbers.
export const mutateLifecycleSticky = async (
  octokit: UpsertOctokit,
  owner: string,
  repo: string,
  issueNumber: number,
  seedState: LifecycleStickyState,
  mutator: (state: LifecycleStickyState) => LifecycleStickyState,
  options: MutateOptions,
  log?: UpsertLogger,
): Promise<void> => {
  await mutateLifecycleStickyEverywhere(
    octokit,
    owner,
    repo,
    { issueNumber },
    seedState,
    mutator,
    options,
    log,
  );
};
