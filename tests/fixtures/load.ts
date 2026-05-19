// Typed fixture builders that compose minimal payloads on top of the
// @octokit/webhooks-types contracts. Tests stay explicit about which
// fields drive the classifier.

import type {
  IssuesLabeledEvent,
  PullRequestClosedEvent,
  PullRequestLabeledEvent,
} from "@octokit/webhooks-types";

const baseRepo = {
  id: 1,
  node_id: "R_1",
  name: "openspec-flow",
  full_name: "dwmkerr/openspec-flow",
  private: false,
  owner: { login: "dwmkerr", id: 1, type: "User" as const, node_id: "U_1" },
} as any;

const baseSender = (type: "User" | "Bot" = "User") =>
  ({ login: type === "User" ? "alex" : "openspec[bot]", id: 1, type } as any);

const baseInstallation = { id: 1, node_id: "I_1" } as any;

interface IssueLabeledOpts {
  issueNumber?: number;
  title?: string;
  state?: "open" | "closed";
  labels?: string[];
  labelAdded?: string;
  senderType?: "User" | "Bot";
  isPullRequest?: boolean;
}

export const issueLabeled = (opts: IssueLabeledOpts = {}): IssuesLabeledEvent => ({
  action: "labeled",
  label: { id: 1, name: opts.labelAdded ?? "openspec:go", color: "0969da" } as any,
  issue: {
    number: opts.issueNumber ?? 42,
    title: opts.title ?? "Add CSV export",
    state: opts.state ?? "open",
    labels: (opts.labels ?? ["openspec:go"]).map((n, i) => ({ id: i, name: n })) as any,
    ...(opts.isPullRequest ? { pull_request: { url: "https://example/pr" } } : {}),
  } as any,
  repository: baseRepo,
  sender: baseSender(opts.senderType),
  installation: baseInstallation,
});

interface PrLabeledOpts {
  prNumber?: number;
  state?: "open" | "closed";
  labels?: string[];
  labelAdded?: string;
  senderType?: "User" | "Bot";
}

export const prLabeled = (opts: PrLabeledOpts = {}): PullRequestLabeledEvent => ({
  action: "labeled",
  number: opts.prNumber ?? 43,
  label: { id: 1, name: opts.labelAdded ?? "openspec:go", color: "0969da" } as any,
  pull_request: {
    number: opts.prNumber ?? 43,
    state: opts.state ?? "open",
    labels: (opts.labels ?? ["openspec:spec", "openspec:go"]).map((n, i) => ({ id: i, name: n })) as any,
  } as any,
  repository: baseRepo,
  sender: baseSender(opts.senderType),
  installation: baseInstallation,
});

interface PrClosedOpts {
  prNumber?: number;
  merged?: boolean;
  labels?: string[];
  body?: string;
  senderType?: "User" | "Bot";
}

export const prClosed = (opts: PrClosedOpts = {}): PullRequestClosedEvent => ({
  action: "closed",
  number: opts.prNumber ?? 43,
  pull_request: {
    number: opts.prNumber ?? 43,
    merged: opts.merged ?? true,
    labels: (opts.labels ?? ["openspec:spec"]).map((n, i) => ({ id: i, name: n })) as any,
    body: opts.body ?? "Closes #42.",
  } as any,
  repository: baseRepo,
  sender: baseSender(opts.senderType),
  installation: baseInstallation,
});
