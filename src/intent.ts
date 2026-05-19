// Pure classifier: GitHub webhook event + payload → openspec-flow intent.
// No network, no I/O. Inputs are fully serialised webhook payloads.
//
// Trigger table is authoritative in CLAUDE.md. Keep this file in sync.

export type Intent =
  | { kind: "create-spec"; issueNumber: number; title: string }
  | { kind: "iterate-spec"; prNumber: number }
  | { kind: "iterate-impl"; prNumber: number }
  | { kind: "create-impl"; specPrNumber: number; issueNumber: number | null }
  | { kind: "noop"; visible: boolean; reason: string };

export const TRIGGER_LABEL = "openspec:go";
export const SPEC_LABEL = "openspec:spec";
export const IMPL_LABEL = "openspec:impl";

const LIFECYCLE_LABELS = new Set([SPEC_LABEL, IMPL_LABEL]);

export const describe = (i: Intent): string => {
  switch (i.kind) {
    case "create-spec":
      return `create specification for issue #${i.issueNumber} — ${i.title}`;
    case "iterate-spec":
      return `iterate on spec PR #${i.prNumber}`;
    case "iterate-impl":
      return `iterate on implementation PR #${i.prNumber}`;
    case "create-impl":
      return `create implementation for merged spec PR #${i.specPrNumber}`;
    case "noop":
      return i.visible ? `Ignored: ${i.reason}.` : `noop — ${i.reason}`;
  }
};

// Helpers — pure, payload-only inspection.

interface LabelLike {
  name: string;
}

const labelNames = (labels: LabelLike[] | undefined | null): Set<string> => {
  if (!labels) return new Set();
  return new Set(labels.map((l) => l.name));
};

export const labelsOn = (target: { labels?: LabelLike[] }): Set<string> =>
  labelNames(target.labels);

const hasSpec = (set: Set<string>): boolean => set.has(SPEC_LABEL);
const hasImpl = (set: Set<string>): boolean => set.has(IMPL_LABEL);

// Determine the "label being added" for issues.labeled / pull_request.labeled.
export const triggerLabel = (payload: { label?: { name: string } }): string | null =>
  payload.label?.name ?? null;

// Classify. Cases not matched fall through to a catch-all visible noop
// when the trigger label is present, otherwise a silent noop.
export const classify = (eventName: string, payload: unknown): Intent => {
  const p = payload as Record<string, unknown>;

  // Self-trigger guard — never act on bot-originated events.
  const sender = p["sender"] as { type?: string } | undefined;
  if (sender?.type === "Bot") {
    return { kind: "noop", visible: false, reason: "bot sender" };
  }

  const action = p["action"] as string | undefined;

  // ---- issues.labeled ----
  if (eventName === "issues" && action === "labeled") {
    const issue = p["issue"] as
      | { number: number; title: string; state: string; labels?: LabelLike[]; pull_request?: unknown }
      | undefined;
    const added = triggerLabel(p);
    if (!issue || added !== TRIGGER_LABEL) {
      return { kind: "noop", visible: false, reason: "non-trigger label on issue" };
    }
    if (issue.pull_request !== undefined) {
      // This is GitHub's quirk: PRs sometimes deliver as "issues" events. Treat as PR.
      return classifyPrLabeled(issue.number, labelsOn(issue));
    }
    if (issue.state === "closed") {
      return {
        kind: "noop",
        visible: true,
        reason: `Issue #${issue.number} is closed. Reopen first.`,
      };
    }
    // Fresh issue, no lifecycle labels (issue itself has no spec/impl) → create-spec.
    return { kind: "create-spec", issueNumber: issue.number, title: issue.title };
  }

  // ---- pull_request.labeled ----
  if (eventName === "pull_request" && action === "labeled") {
    const pr = p["pull_request"] as
      | { number: number; state: string; labels?: LabelLike[] }
      | undefined;
    const added = triggerLabel(p);
    if (!pr) return { kind: "noop", visible: false, reason: "no PR in payload" };

    // User manually applied a bot-managed label → transfer mode, step back.
    if (added === SPEC_LABEL || added === IMPL_LABEL) {
      return {
        kind: "noop",
        visible: true,
        reason: `\`${added}\` is bot-managed. openspec-flow is stepping back on PR #${pr.number}; manage it manually.`,
      };
    }

    if (added !== TRIGGER_LABEL) {
      return { kind: "noop", visible: false, reason: "non-trigger label on PR" };
    }

    if (pr.state === "closed") {
      return {
        kind: "noop",
        visible: true,
        reason: `PR #${pr.number} is closed. Reopen first.`,
      };
    }
    return classifyPrLabeled(pr.number, labelsOn(pr));
  }

  // ---- pull_request.closed (merge detection) ----
  if (eventName === "pull_request" && action === "closed") {
    const pr = p["pull_request"] as
      | { number: number; merged: boolean; labels?: LabelLike[]; body?: string | null }
      | undefined;
    if (!pr) return { kind: "noop", visible: false, reason: "no PR in payload" };
    if (!pr.merged) {
      const labels = labelsOn(pr);
      if (hasSpec(labels)) {
        return {
          kind: "noop",
          visible: true,
          reason: `Spec PR #${pr.number} closed without merging. No implementation PR will open. To resume, open a fresh issue.`,
        };
      }
      return { kind: "noop", visible: false, reason: "PR closed unmerged (non-lifecycle)" };
    }
    const labels = labelsOn(pr);
    if (hasSpec(labels) && hasImpl(labels)) {
      return {
        kind: "noop",
        visible: true,
        reason: `PR #${pr.number} carries both \`${SPEC_LABEL}\` and \`${IMPL_LABEL}\`. Resolve manually.`,
      };
    }
    if (hasSpec(labels)) {
      const issueNumber = extractClosesIssue(pr.body ?? null);
      return { kind: "create-impl", specPrNumber: pr.number, issueNumber };
    }
    if (hasImpl(labels)) {
      return {
        kind: "noop",
        visible: false,
        reason: "impl PR merged — issue closes via Closes; nothing more to do",
      };
    }
    return { kind: "noop", visible: false, reason: "non-lifecycle PR merged" };
  }

  // ---- everything else: silent noop ----
  return { kind: "noop", visible: false, reason: `event ${eventName}.${action ?? "?"} not a trigger` };
};

// Subroutine: classify an openspec:go addition on a PR.
const classifyPrLabeled = (prNumber: number, labels: Set<string>): Intent => {
  const spec = hasSpec(labels);
  const impl = hasImpl(labels);
  if (spec && impl) {
    return {
      kind: "noop",
      visible: true,
      reason: `PR #${prNumber} has both \`${SPEC_LABEL}\` and \`${IMPL_LABEL}\`. Resolve manually.`,
    };
  }
  if (spec) return { kind: "iterate-spec", prNumber };
  if (impl) return { kind: "iterate-impl", prNumber };
  return {
    kind: "noop",
    visible: true,
    reason: `PR #${prNumber} is not managed by openspec-flow. Open a fresh issue with \`${TRIGGER_LABEL}\` instead.`,
  };
};

const closesRegex = /\b(?:closes|fixes|resolves)\s+#(\d+)\b/i;

const extractClosesIssue = (body: string | null): number | null => {
  if (!body) return null;
  const m = body.match(closesRegex);
  return m ? parseInt(m[1], 10) : null;
};
